import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type { CreateUserInput, ListAllUsersQuery, ListUsersQuery, UpdateUserInput } from '../validations/userValidation.js';

// This endpoint only manages MANAGER/SUPERVISOR accounts — ADMIN row never touched here.
const MANAGED_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.EMPLOYEE];

const managedUserSelect = {
    id: true,
    companyId: true,
    name: true,
    mobile: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.UserSelect;

/** Maps a Prisma unique-constraint violation on [companyId, mobile] to a stable conflict error. */
function mapUniqueConstraintError(err: unknown): never | undefined {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return undefined;
    throw new ConflictError('A user with this mobile number already exists in this company', 'USER_MOBILE_EXISTS');
}

export async function createManagedUser(input: CreateUserInput, companyId: string) {
    const passwordHash = await hashPassword(input.password);

    try {
        return await prisma.user.create({
            data: {
                companyId,
                name: input.name,
                mobile: input.mobile,
                passwordHash,
                role: input.role,
            },
            select: managedUserSelect,
        });
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

    return { items: rows, meta: toPageMeta(query, total) };
}

export async function getUserById(id: string, companyId: string) {
    const user = await prisma.user.findFirst({
        where: { id, companyId, role: { in: MANAGED_ROLES } },
        select: managedUserSelect,
    });
    if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND', { id });
    return user;
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

    return prisma.user.update({
        where: { id },
        data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.role !== undefined ? { role: input.role } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        select: managedUserSelect,
    });
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

    return { items: rows, meta: toPageMeta(query, total) };
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
