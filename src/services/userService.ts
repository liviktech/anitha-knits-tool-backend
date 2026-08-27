import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type { CreateUserInput, ListAllUsersQuery, ListUsersQuery, UpdateUserInput } from '../validations/userValidation.js';

// This endpoint only manages MANAGER/SUPERVISOR accounts — ADMIN row never touched here.
const MANAGED_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE];

export const employeeDetailsSelect = {
    customUserId: true,
    designation: true,
    address: true,
    gender: true,
    salary: true,
    joiningDate: true,
    aadhaarDocumentUrl: true,
    documentName: true,
    aadhaarDocumentUploadedAt: true,
} satisfies Prisma.EmployeeDetailsSelect;

/**
 * Atomically assigns the next customUserId for a company: companyCode + a
 * zero-padded sequence (e.g. "AK001" + "001"). Reads `employeeSeq` as a
 * counter, not a row count, so a later-deleted user/employeeDetails row can
 * never cause a number to be reissued. Must run inside the same transaction
 * as the User/EmployeeDetails create it backs, so a failed create can't
 * "burn" a sequence number that's then unaccounted for.
 * Time: O(1) — one row update, serialized by Postgres row-level locking under concurrent callers.
 */
export async function nextCustomUserId(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const company = await tx.company.update({
        where: { id: companyId },
        data: { employeeSeq: { increment: 1 } },
        select: { companyCode: true, employeeSeq: true },
    });
    const seq = company.employeeSeq - 1;
    return `EMP-${String(seq).padStart(3, '0')}`;
}

export type EmployeeDetailsRow = Prisma.EmployeeDetailsGetPayload<{ select: typeof employeeDetailsSelect }>;

/** Prisma Decimal isn't JSON-safe as a number — convert salary explicitly, matching the rest of the codebase's Decimal handling. */
export function mapEmployeeDetails(details: EmployeeDetailsRow | null) {
    if (!details) return null;
    return { ...details, salary: details.salary ? details.salary.toNumber() : null };
}

export function withMappedEmployeeDetails<T extends { employeeDetails: EmployeeDetailsRow | null }>(user: T) {
    return { ...user, employeeDetails: mapEmployeeDetails(user.employeeDetails) };
}

const managedUserSelect = {
    id: true,
    companyId: true,
    name: true,
    mobile: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    employeeDetails: { select: employeeDetailsSelect },
} satisfies Prisma.UserSelect;

/** Maps a Prisma unique-constraint violation on [companyId, mobile] to a stable conflict error. */
function mapUniqueConstraintError(err: unknown): never | undefined {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return undefined;
    throw new ConflictError('A user with this mobile number already exists in this company', 'USER_MOBILE_EXISTS');
}

export async function createManagedUser(input: CreateUserInput, companyId: string) {
    const passwordHash = await hashPassword(input.password);

    try {
        const user = await prisma.$transaction(async (tx) => {
            const customUserId = await nextCustomUserId(tx, companyId);
            return tx.user.create({
                data: {
                    companyId,
                    name: input.name,
                    mobile: input.mobile,
                    passwordHash,
                    role: input.role,
                    employeeDetails: {
                        create: {
                            customUserId,
                            designation: input.employeeDetails?.designation,
                            address: input.employeeDetails?.address,
                            gender: input.employeeDetails?.gender,
                            salary: input.employeeDetails?.salary,
                            joiningDate: input.employeeDetails?.joiningDate,
                        },
                    },
                },
                select: managedUserSelect,
            });
        });
        return withMappedEmployeeDetails(user);
    } catch (err) {
        mapUniqueConstraintError(err);
        throw err;
    }
}

export async function listUsers(query: ListUsersQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const where: Prisma.UserWhereInput = {
        companyId,
        role: query.role ? query.role : { in: MANAGED_ROLES },
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.user.findMany({ where, select: managedUserSelect, orderBy: { createdAt: 'desc' }, skip, take }),
        prisma.user.count({ where }),
    ]);

    return { items: rows.map(withMappedEmployeeDetails), meta: toPageMeta(query, total) };
}

export async function getUserById(id: string, companyId: string) {
    const user = await prisma.user.findFirst({
        where: { id, companyId, role: { in: MANAGED_ROLES } },
        select: managedUserSelect,
    });
    if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND', { id });
    return withMappedEmployeeDetails(user);
}

export async function updateUser(id: string, input: UpdateUserInput, companyId: string, actingUserId: string) {
    if (id === actingUserId) {
        throw new ConflictError('You cannot modify your own account through this endpoint', 'CANNOT_MODIFY_SELF');
    }

    const existing = await prisma.user.findFirst({
        where: { id, companyId, role: { in: MANAGED_ROLES } },
        select: { id: true },
    });
    if (!existing) throw new NotFoundError('User not found', 'USER_NOT_FOUND', { id });

    const user = await prisma.user.update({
        where: { id },
        data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.role !== undefined ? { role: input.role } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            // Every managed user gets an employeeDetails row at creation time (customUserId is
            // assigned there, atomically, via nextCustomUserId) — a plain update is enough, not upsert.
            ...(input.employeeDetails
                ? {
                      employeeDetails: {
                          update: {
                              ...(input.employeeDetails.designation !== undefined ? { designation: input.employeeDetails.designation } : {}),
                              ...(input.employeeDetails.address !== undefined ? { address: input.employeeDetails.address } : {}),
                              ...(input.employeeDetails.gender !== undefined ? { gender: input.employeeDetails.gender } : {}),
                              ...(input.employeeDetails.salary !== undefined ? { salary: input.employeeDetails.salary } : {}),
                              ...(input.employeeDetails.joiningDate !== undefined ? { joiningDate: input.employeeDetails.joiningDate } : {}),
                          },
                      },
                  }
                : {}),
        },
        select: managedUserSelect,
    });
    return withMappedEmployeeDetails(user);
}

const allCompanyUsersSelect = {
    id: true,
    companyId: true,
    name: true,
    mobile: true,
    role: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    employeeDetails: { select: employeeDetailsSelect },
} satisfies Prisma.UserSelect;

/** Full company roster, all four roles — unlike listUsers, which is scoped to MANAGER/SUPERVISOR only. */
export async function listAllCompanyUsers(query: ListAllUsersQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const where: Prisma.UserWhereInput = {
        companyId,
        ...(query.role ? { role: query.role } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.user.findMany({ where, select: allCompanyUsersSelect, orderBy: { createdAt: 'desc' }, skip, take }),
        prisma.user.count({ where }),
    ]);

    return { items: rows.map(withMappedEmployeeDetails), meta: toPageMeta(query, total) };
}

/** Soft-deletes (deactivates) a managed user — reversible, and avoids inventing a restore path. */
export async function deleteUser(id: string, companyId: string, actingUserId: string) {
    if (id === actingUserId) {
        throw new ConflictError('You cannot modify your own account through this endpoint', 'CANNOT_MODIFY_SELF');
    }

    const existing = await prisma.user.findFirst({
        where: { id, companyId, role: { in: MANAGED_ROLES } },
        select: { id: true },
    });
    if (!existing) throw new NotFoundError('User not found', 'USER_NOT_FOUND', { id });

    await prisma.user.update({ where: { id }, data: { isActive: false } });
}
