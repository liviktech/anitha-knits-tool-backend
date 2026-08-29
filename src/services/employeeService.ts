import { Prisma, UserRole } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import {
  EMPLOYEE_AADHAAR_PREFIX,
  EMPLOYEE_PHOTO_PREFIX,
} from '../config/s3.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { uploadEmployeeFile } from './s3UploadService.js';
import { nextCustomUserId } from './userService.js';
import type {
  CreateEmployeeInput,
  ListEmployeesQuery,
  UpdateEmployeeInput,
} from '../validations/employeeValidation.js';

export interface EmployeeUploadFiles {
  photo?: Express.Multer.File;
  aadhaarFile?: Express.Multer.File;
}

// The Employees Directory manages all three non-admin roles from one screen — Manager/Supervisor
// creation used to go through a separate /company/user endpoint (removed; it had zero frontend
// callers) and is now consolidated here.
const MANAGED_ROLES: UserRole[] = [UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.SUPERVISOR];

// A company may have at most one active MANAGER and one active SUPERVISOR at a time (Employee is
// uncapped). Kept as named constants, not a DB constraint, so the limit is easy to change later.
// Deactivating an existing holder (isActive: false) frees their slot — only active users count.
const MAX_MANAGERS_PER_COMPANY = 1;
const MAX_SUPERVISORS_PER_COMPANY = 1;

export const employeeSelect = {
  id: true,
  companyId: true,
  name: true,
  mobile: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  roleAccessId: true,
  roleAccess: { select: { id: true, roleName: true } },
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
  if (
    !(err instanceof Prisma.PrismaClientKnownRequestError) ||
    err.code !== 'P2002'
  )
    return undefined;
  throw new ConflictError(
    'A user with this mobile number already exists in this company',
    'USER_MOBILE_EXISTS',
  );
}

/** Uploads whichever of photo/aadhaarFile were provided, in parallel. Lets S3 errors propagate — the caller's request fails rather than saving a partial record. */
async function uploadProvidedEmployeeFiles(
  companyId: string,
  files?: EmployeeUploadFiles,
) {
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

/** Throws ConflictError if creating a MANAGER/SUPERVISOR would exceed this company's one-active-holder cap. Employee is uncapped. */
async function assertRoleCapNotExceeded(role: UserRole, companyId: string) {
  if (role === UserRole.EMPLOYEE) return;

  const max = role === UserRole.MANAGER ? MAX_MANAGERS_PER_COMPANY : MAX_SUPERVISORS_PER_COMPANY;
  const activeCount = await prisma.user.count({ where: { companyId, role, isActive: true } });
  if (activeCount >= max) {
    throw new ConflictError(
      `This company already has an active ${role === UserRole.MANAGER ? 'Manager' : 'Supervisor'} — deactivate them first to add a new one`,
      role === UserRole.MANAGER ? 'MANAGER_LIMIT_REACHED' : 'SUPERVISOR_LIMIT_REACHED',
    );
  }
}

export async function createEmployee(
  input: CreateEmployeeInput,
  companyId: string,
  files?: EmployeeUploadFiles,
) {
  const role = input.role ?? UserRole.EMPLOYEE;
  await assertRoleCapNotExceeded(role, companyId);

  const passwordHash = await hashPassword(input.password);

  // Upload before the transaction so a slow S3 call never ties up a pooled DB connection.
  const { photoUrl, aadhaarDocumentUrl } = await uploadProvidedEmployeeFiles(
    companyId,
    files,
  );

  try {
    const user = await prisma.$transaction(async (tx) => {
      const customUserId = await nextCustomUserId(tx, companyId);
      return tx.user.create({
        data: {
          companyId,
          name: input.name,
          mobile: input.mobile,
          passwordHash,
          role,
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
                ? {
                    aadhaarDocumentUrl,
                    documentName: files!.aadhaarFile!.originalname,
                    aadhaarDocumentUploadedAt: new Date(),
                  }
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

export async function listEmployees(
  query: ListEmployeesQuery,
  companyId: string,
) {
  const { skip, take } = toSkipTake(query);
  const where: Prisma.UserWhereInput = {
    companyId,
    role: query.role ? query.role : { in: MANAGED_ROLES },
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: employeeSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  return { items: rows.map(mapEmployee), meta: toPageMeta(query, total) };
}

export async function getEmployeeById(id: string, companyId: string) {
  const user = await prisma.user.findFirst({
    where: { id, companyId, role: { in: MANAGED_ROLES } },
    select: employeeSelect,
  });
  if (!user)
    throw new NotFoundError('Employee not found', 'EMPLOYEE_NOT_FOUND', { id });
  return mapEmployee(user);
}

export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput,
  companyId: string,
  files?: EmployeeUploadFiles,
) {
  const existing = await prisma.user.findFirst({
    where: { id, companyId, role: { in: MANAGED_ROLES } },
    select: { id: true },
  });
  if (!existing)
    throw new NotFoundError('Employee not found', 'EMPLOYEE_NOT_FOUND', { id });

  // Upload before the write, and only for slots where a new file was actually provided —
  // an untouched file picker must never overwrite a previously-saved photo/document URL.
  const { photoUrl, aadhaarDocumentUrl } = await uploadProvidedEmployeeFiles(
    companyId,
    files,
  );

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        employeeDetails: {
          update: {
            ...(input.designation !== undefined
              ? { designation: input.designation }
              : {}),
            ...(input.address !== undefined ? { address: input.address } : {}),
            ...(input.gender !== undefined ? { gender: input.gender } : {}),
            ...(input.salary !== undefined ? { salary: input.salary } : {}),
            ...(input.aadhaarNumber !== undefined
              ? { aadhaarNumber: input.aadhaarNumber }
              : {}),
            ...(input.joiningDate !== undefined
              ? { joiningDate: input.joiningDate }
              : {}),
            ...(photoUrl ? { photoUrl } : {}),
            ...(aadhaarDocumentUrl
              ? {
                  aadhaarDocumentUrl,
                  documentName: files!.aadhaarFile!.originalname,
                  aadhaarDocumentUploadedAt: new Date(),
                }
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
    where: { id, companyId, role: { in: MANAGED_ROLES } },
    select: { id: true },
  });
  if (!existing)
    throw new NotFoundError('Employee not found', 'EMPLOYEE_NOT_FOUND', { id });

  await prisma.user.update({ where: { id }, data: { isActive: false } });
}
