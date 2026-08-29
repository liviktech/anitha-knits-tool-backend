import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type {
    AssignRoleAccessInput,
    CreateRoleAccessInput,
    ListRoleAccessQuery,
    UpdateRoleAccessInput,
} from '../validations/roleAccessValidation.js';

const roleAccessSelect = {
    id: true,
    roleName: true,
    description: true,
    createdAt: true,
    updatedAt: true,
    rights: { select: { rightId: true } },
} satisfies Prisma.RoleAccessSelect;

type RoleAccessRow = Prisma.RoleAccessGetPayload<{ select: typeof roleAccessSelect }>;

function mapRoleAccessRecord(record: RoleAccessRow) {
    const { rights, ...rest } = record;
    return { ...rest, rightIds: rights.map((r) => r.rightId) };
}

/** Throws if any id in rightIds doesn't belong to a Right owned by this company. */
async function assertRightsInCompany(rightIds: string[], companyId: string) {
    if (rightIds.length === 0) return;
    const count = await prisma.right.count({ where: { id: { in: rightIds }, companyId } });
    if (count !== rightIds.length) {
        throw new ValidationError('One or more rightIds do not reference an existing right for this company', 'INVALID_RIGHT_ID');
    }
}

/** Maps a unique-constraint violation on [companyId, roleName] to a stable conflict error. */
function mapRoleNameConflict(err: unknown): never | undefined {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return undefined;
    throw new ConflictError('A role with this name already exists', 'ROLE_NAME_EXISTS');
}

export async function createRoleAccess(input: CreateRoleAccessInput, companyId: string) {
    const rightIds = Array.from(new Set(input.rightIds));
    await assertRightsInCompany(rightIds, companyId);

    try {
        const record = await prisma.$transaction(async (tx) => {
            const created = await tx.roleAccess.create({
                data: { companyId, roleName: input.roleName, description: input.description },
                select: { id: true },
            });
            if (rightIds.length > 0) {
                await tx.roleAccessRight.createMany({
                    data: rightIds.map((rightId) => ({ roleAccessId: created.id, rightId })),
                });
            }
            return tx.roleAccess.findUniqueOrThrow({ where: { id: created.id }, select: roleAccessSelect });
        });

        return mapRoleAccessRecord(record);
    } catch (err) {
        mapRoleNameConflict(err);
        throw err;
    }
}

export async function listRoleAccesses(query: ListRoleAccessQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);

    const where: Prisma.RoleAccessWhereInput = {
        companyId,
        ...(query.name
            ? {
                OR: [
                    { roleName: { contains: query.name, mode: 'insensitive' } },
                    { description: { contains: query.name, mode: 'insensitive' } },
                ],
            }
            : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.roleAccess.findMany({ where, select: roleAccessSelect, orderBy: { roleName: 'asc' }, skip, take }),
        prisma.roleAccess.count({ where }),
    ]);

    return { items: rows.map(mapRoleAccessRecord), meta: toPageMeta(query, total) };
}

export async function getRoleAccessById(id: string, companyId: string) {
    const record = await prisma.roleAccess.findFirst({ where: { id, companyId }, select: roleAccessSelect });
    if (!record) throw new NotFoundError('Role not found', 'ROLE_ACCESS_NOT_FOUND', { id });
    return mapRoleAccessRecord(record);
}

export async function updateRoleAccess(id: string, input: UpdateRoleAccessInput, companyId: string) {
    const existing = await prisma.roleAccess.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!existing) throw new NotFoundError('Role not found', 'ROLE_ACCESS_NOT_FOUND', { id });

    const rightIds = input.rightIds !== undefined ? Array.from(new Set(input.rightIds)) : undefined;
    if (rightIds !== undefined) {
        await assertRightsInCompany(rightIds, companyId);
    }

    try {
        const record = await prisma.$transaction(async (tx) => {
            await tx.roleAccess.update({
                where: { id },
                data: {
                    ...(input.roleName !== undefined ? { roleName: input.roleName } : {}),
                    ...(input.description !== undefined ? { description: input.description } : {}),
                },
            });

            if (rightIds !== undefined) {
                await tx.roleAccessRight.deleteMany({ where: { roleAccessId: id } });
                if (rightIds.length > 0) {
                    await tx.roleAccessRight.createMany({
                        data: rightIds.map((rightId) => ({ roleAccessId: id, rightId })),
                    });
                }
            }

            return tx.roleAccess.findUniqueOrThrow({ where: { id }, select: roleAccessSelect });
        });

        return mapRoleAccessRecord(record);
    } catch (err) {
        mapRoleNameConflict(err);
        throw err;
    }
}

export async function deleteRoleAccess(id: string, companyId: string) {
    const existing = await prisma.roleAccess.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!existing) throw new NotFoundError('Role not found', 'ROLE_ACCESS_NOT_FOUND', { id });

    // RoleAccessRight rows cascade-delete; any User.roleAccessId pointing here is SetNull (schema).
    await prisma.roleAccess.delete({ where: { id } });
}

export interface AccessGrant {
    moduleCode: string;
    /** null = this grant covers the whole module, not one specific tab (most modules have no Tabs). */
    tabCode: string | null;
}

/**
 * Resolves the distinct (moduleCode, tabCode) pairs a RoleAccess's rights unlock, via
 * RoleAccessRight -> Right -> Module (+ optionally Tab). Returns [] if the role has no rights yet.
 */
export async function resolveRoleAccessGrants(roleAccessId: string, companyId: string): Promise<AccessGrant[]> {
    const rows = await prisma.roleAccessRight.findMany({
        where: { roleAccessId, right: { companyId } },
        select: {
            right: {
                select: {
                    module: { select: { moduleCode: true } },
                    tab: { select: { tabCode: true } },
                },
            },
        },
    });

    const seen = new Set<string>();
    const grants: AccessGrant[] = [];
    for (const row of rows) {
        const { moduleCode } = row.right.module;
        const tabCode = row.right.tab?.tabCode ?? null;
        const key = `${moduleCode}:${tabCode ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        grants.push({ moduleCode, tabCode });
    }
    return grants;
}

export async function assignRoleAccessToEmployees(id: string, input: AssignRoleAccessInput, companyId: string) {
    const roleAccess = await prisma.roleAccess.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!roleAccess) throw new NotFoundError('Role not found', 'ROLE_ACCESS_NOT_FOUND', { id });

    const employeeIds = Array.from(new Set(input.employeeIds));
    const employeeCount = await prisma.user.count({ where: { id: { in: employeeIds }, companyId } });
    if (employeeCount !== employeeIds.length) {
        throw new ValidationError('One or more employeeIds do not reference an existing employee for this company', 'INVALID_EMPLOYEE_ID');
    }

    await prisma.user.updateMany({
        where: { id: { in: employeeIds }, companyId },
        data: { roleAccessId: id },
    });
}
