import { Prisma, UserRole } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import { EMPLOYEE_AADHAAR_PREFIX, EMPLOYEE_PHOTO_PREFIX } from '../config/s3.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { uploadEmployeeFile } from './s3UploadService.js';
import { nextCustomUserId } from './userService.js';
import type { CreateEmployeeInput, ListEmployeesQuery, UpdateEmployeeInput } from '../validations/employeeValidation.js';

export interface EmployeeUploadFiles {
    photo?: Express.Multer.File;
    aadhaarFile?: Express.Multer.File;
}

export const employeeSelect = {
    id: true,
    companyId: true,
    name: true,
    mobile: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    employeeDetails: {
        select: {
            customUserId: true,
            designation: true,
            address: true,
            gender: true,
            salary: true,
            aadhaarNumber: true,
            joiningDate: true,
            photoUrl: true,
            aadhaarDocumentUrl: true,
            documentName: true,
            aadhaarDocumentUploadedAt: true,
        },
    },
} satisfies Prisma.UserSelect;

type EmployeeRow = Prisma.UserGetPayload<{ select: typeof employeeSelect }>;

export function mapEmployee(user: EmployeeRow | null) {
    if (!user) return null;
    const details = user.employeeDetails;
    return {
        ...user,
        employeeDetails: details
            ? {
                  ...details,
                  salary: details.salary ? details.salary.toNumber() : null,
              }
            : null,
    };
}

/** Maps a Prisma unique-constraint violation on [companyId, mobile] to a stable conflict error. */
function mapUniqueConstraintError(err: unknown): never | undefined {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return undefined;
    throw new ConflictError('A user with this mobile number already exists in this company', 'USER_MOBILE_EXISTS');
}

/** Uploads whichever of photo/aadhaarFile were provided, in parallel. Lets S3 errors propagate — the caller's request fails rather than saving a partial record. */
async function uploadProvidedEmployeeFiles(companyId: string, files?: EmployeeUploadFiles) {
    const [photoUrl, aadhaarDocumentUrl] = await Promise.all([
        files?.photo
            ? uploadEmployeeFile({
                  buffer: files.photo.buffer,
                  mimetype: files.photo.mimetype,
                  originalName: files.photo.originalname,
                  companyId,
                  prefix: EMPLOYEE_PHOTO_PREFIX,
              })
            : Promise.resolve(undefined),
        files?.aadhaarFile
            ? uploadEmployeeFile({
                  buffer: files.aadhaarFile.buffer,
                  mimetype: files.aadhaarFile.mimetype,
                  originalName: files.aadhaarFile.originalname,
                  companyId,
                  prefix: EMPLOYEE_AADHAAR_PREFIX,
              })
            : Promise.resolve(undefined),
    ]);
    return { photoUrl, aadhaarDocumentUrl };
}

export async function createEmployee(input: CreateEmployeeInput, companyId: string, files?: EmployeeUploadFiles) {
    // Generate a secure random password since employees don't log in directly
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await hashPassword(randomPassword);

    // Upload before the transaction so a slow S3 call never ties up a pooled DB connection.
    const { photoUrl, aadhaarDocumentUrl } = await uploadProvidedEmployeeFiles(companyId, files);

    try {
        const user = await prisma.$transaction(async (tx) => {
            const customUserId = await nextCustomUserId(tx, companyId);
            return tx.user.create({
                data: {
                    companyId,
                    name: input.name,
                    mobile: input.mobile,
                    passwordHash,
                    role: UserRole.EMPLOYEE,
                    employeeDetails: {
                        create: {
                            customUserId,
                            designation: input.designation,
                            address: input.address,
                            gender: input.gender,
                            salary: input.salary,
                            aadhaarNumber: input.aadhaarNumber,
                            joiningDate: input.joiningDate,
                            ...(photoUrl ? { photoUrl } : {}),
                            ...(aadhaarDocumentUrl
                                ? { aadhaarDocumentUrl, documentName: files!.aadhaarFile!.originalname, aadhaarDocumentUploadedAt: new Date() }
                                : {}),
                        },
                    },
                },
                select: employeeSelect,
            });
        });
        return mapEmployee(user);
    } catch (err) {
        mapUniqueConstraintError(err);
        throw err;
    }
}

export async function listEmployees(query: ListEmployeesQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const where: Prisma.UserWhereInput = {
        companyId,
        role: UserRole.EMPLOYEE,
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.user.findMany({ where, select: employeeSelect, orderBy: { createdAt: 'desc' }, skip, take }),
        prisma.user.count({ where }),
    ]);

    return { items: rows.map(mapEmployee), meta: toPageMeta(query, total) };
}

export async function getEmployeeById(id: string, companyId: string) {
    const user = await prisma.user.findFirst({
        where: { id, companyId, role: UserRole.EMPLOYEE },
        select: employeeSelect,
    });
    if (!user) throw new NotFoundError('Employee not found', 'EMPLOYEE_NOT_FOUND', { id });
    return mapEmployee(user);
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput, companyId: string, files?: EmployeeUploadFiles) {
    const existing = await prisma.user.findFirst({
        where: { id, companyId, role: UserRole.EMPLOYEE },
        select: { id: true },
    });
    if (!existing) throw new NotFoundError('Employee not found', 'EMPLOYEE_NOT_FOUND', { id });

    // Upload before the write, and only for slots where a new file was actually provided —
    // an untouched file picker must never overwrite a previously-saved photo/document URL.
    const { photoUrl, aadhaarDocumentUrl } = await uploadProvidedEmployeeFiles(companyId, files);

    try {
        const user = await prisma.user.update({
            where: { id },
            data: {
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
                ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
                employeeDetails: {
                    update: {
                        ...(input.designation !== undefined ? { designation: input.designation } : {}),
                        ...(input.address !== undefined ? { address: input.address } : {}),
                        ...(input.gender !== undefined ? { gender: input.gender } : {}),
                        ...(input.salary !== undefined ? { salary: input.salary } : {}),
                        ...(input.aadhaarNumber !== undefined ? { aadhaarNumber: input.aadhaarNumber } : {}),
                        ...(input.joiningDate !== undefined ? { joiningDate: input.joiningDate } : {}),
                        ...(photoUrl ? { photoUrl } : {}),
                        ...(aadhaarDocumentUrl
                            ? { aadhaarDocumentUrl, documentName: files!.aadhaarFile!.originalname, aadhaarDocumentUploadedAt: new Date() }
                            : {}),
                    },
                },
            },
            select: employeeSelect,
        });
        return mapEmployee(user);
    } catch (err) {
        mapUniqueConstraintError(err);
        throw err;
    }
}

export async function deleteEmployee(id: string, companyId: string) {
    const existing = await prisma.user.findFirst({
        where: { id, companyId, role: UserRole.EMPLOYEE },
        select: { id: true },
    });
    if (!existing) throw new NotFoundError('Employee not found', 'EMPLOYEE_NOT_FOUND', { id });

    await prisma.user.update({ where: { id }, data: { isActive: false } });
}
