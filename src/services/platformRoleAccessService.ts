import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type {
    AssignPlatformRoleAccessInput,
    CreatePlatformRoleAccessInput,
    ListPlatformRoleAccessQuery,
    UpdatePlatformRoleAccessInput,
} from '../validations/platformRoleAccessValidation.js';

const platformRoleAccessSelect = {
    id: true,
    roleName: true,
    description: true,
    createdAt: true,
    updatedAt: true,
    rights: { select: { rightId: true } },
} satisfies Prisma.PlatformRoleAccessSelect;

type PlatformRoleAccessRow = Prisma.PlatformRoleAccessGetPayload<{ select: typeof platformRoleAccessSelect }>;

function mapPlatformRoleAccessRecord(record: PlatformRoleAccessRow) {
    const { rights, ...rest } = record;
    return { ...rest, rightIds: rights.map((r) => r.rightId) };
}

/** Throws if any id in rightIds doesn't reference an existing PlatformRight. */
async function assertRightsExist(rightIds: string[]) {
    if (rightIds.length === 0) return;
    const count = await prisma.platformRight.count({ where: { id: { in: rightIds } } });
    if (count !== rightIds.length) {
        throw new ValidationError('One or more rightIds do not reference an existing right', 'INVALID_RIGHT_ID');
    }
}

/** Maps a unique-constraint violation on roleName to a stable conflict error. */
function mapRoleNameConflict(err: unknown): never | undefined {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return undefined;
    throw new ConflictError('A role with this name already exists', 'PLATFORM_ROLE_NAME_EXISTS');
}

export async function createPlatformRoleAccess(input: CreatePlatformRoleAccessInput) {
    const rightIds = Array.from(new Set(input.rightIds));
    await assertRightsExist(rightIds);

    try {
        const record = await prisma.$transaction(async (tx) => {
            const created = await tx.platformRoleAccess.create({
                data: { roleName: input.roleName, description: input.description },
                select: { id: true },
            });
            if (rightIds.length > 0) {
                await tx.platformRoleAccessRight.createMany({
                    data: rightIds.map((rightId) => ({ roleAccessId: created.id, rightId })),
                });
            }
            return tx.platformRoleAccess.findUniqueOrThrow({ where: { id: created.id }, select: platformRoleAccessSelect });
        });

        return mapPlatformRoleAccessRecord(record);
    } catch (err) {
        mapRoleNameConflict(err);
        throw err;
    }
}

export async function listPlatformRoleAccesses(query: ListPlatformRoleAccessQuery) {
    const { skip, take } = toSkipTake(query);

    const where: Prisma.PlatformRoleAccessWhereInput = {
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
        prisma.platformRoleAccess.findMany({ where, select: platformRoleAccessSelect, orderBy: { roleName: 'asc' }, skip, take }),
        prisma.platformRoleAccess.count({ where }),
    ]);

    return { items: rows.map(mapPlatformRoleAccessRecord), meta: toPageMeta(query, total) };
}

export async function getPlatformRoleAccessById(id: string) {
    const record = await prisma.platformRoleAccess.findUnique({ where: { id }, select: platformRoleAccessSelect });
    if (!record) throw new NotFoundError('Role not found', 'PLATFORM_ROLE_ACCESS_NOT_FOUND', { id });
    return mapPlatformRoleAccessRecord(record);
}

export async function updatePlatformRoleAccess(id: string, input: UpdatePlatformRoleAccessInput) {
    const existing = await prisma.platformRoleAccess.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Role not found', 'PLATFORM_ROLE_ACCESS_NOT_FOUND', { id });

    const rightIds = input.rightIds !== undefined ? Array.from(new Set(input.rightIds)) : undefined;
    if (rightIds !== undefined) {
        await assertRightsExist(rightIds);
    }

    try {
        const record = await prisma.$transaction(async (tx) => {
            await tx.platformRoleAccess.update({
                where: { id },
                data: {
                    ...(input.roleName !== undefined ? { roleName: input.roleName } : {}),
                    ...(input.description !== undefined ? { description: input.description } : {}),
                },
            });

            if (rightIds !== undefined) {
                await tx.platformRoleAccessRight.deleteMany({ where: { roleAccessId: id } });
                if (rightIds.length > 0) {
                    await tx.platformRoleAccessRight.createMany({
                        data: rightIds.map((rightId) => ({ roleAccessId: id, rightId })),
                    });
                }
            }

            return tx.platformRoleAccess.findUniqueOrThrow({ where: { id }, select: platformRoleAccessSelect });
        });

        return mapPlatformRoleAccessRecord(record);
    } catch (err) {
        mapRoleNameConflict(err);
        throw err;
    }
}

export async function deletePlatformRoleAccess(id: string) {
    const existing = await prisma.platformRoleAccess.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Role not found', 'PLATFORM_ROLE_ACCESS_NOT_FOUND', { id });

    // PlatformRoleAccessRight rows cascade-delete; any PlatformEmployeeAccess.roleAccessId
    // pointing here is SetNull (schema) — the employee keeps their LK Space access but loses
    // all grants until reassigned.
    await prisma.platformRoleAccess.delete({ where: { id } });
}

export interface PlatformAccessGrant {
    moduleCode: string;
    /** null = this grant covers the whole module, not one specific tab (LK Space's modules today have no tabs). */
    tabCode: string | null;
}

export interface PlatformUserAccess {
    grants: PlatformAccessGrant[];
    moduleCodes: string[];
    rights: string[];
    /** The assigned PlatformRoleAccess's display name (e.g. "Manager"), or null if none is assigned — shown in the LK Space sidebar. */
    roleName: string | null;
}

/** Resolves the distinct (moduleCode, tabCode) pairs a PlatformRoleAccess's rights unlock. */
async function resolvePlatformRoleAccessGrants(roleAccessId: string): Promise<PlatformAccessGrant[]> {
    const rows = await prisma.platformRoleAccessRight.findMany({
        where: { roleAccessId },
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
    const grants: PlatformAccessGrant[] = [];
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

async function resolvePlatformRoleAccessRightNames(roleAccessId: string): Promise<string[]> {
    const rows = await prisma.platformRoleAccessRight.findMany({
        where: { roleAccessId },
        select: { right: { select: { rightName: true } } },
    });
    return rows.map((row) => row.right.rightName);
}

/**
 * The single source of truth for "what can this LK Space session see" — used by both the
 * login/me response (platformAdminService) and the requirePlatformModuleAccess route
 * middleware, mirroring the company-side resolveUserAccess/requireModuleAccess split.
 *
 * `null` = unrestricted (SUPER_ADMIN, always). An `EMPLOYEE` defaults to ZERO access with no
 * PlatformEmployeeAccess row (or one with no roleAccessId) — access must be explicitly granted.
 */
export async function resolvePlatformAccess(
    role: 'SUPER_ADMIN' | 'EMPLOYEE',
    livikEmpId: string | null,
): Promise<PlatformUserAccess | null> {
    if (role === 'SUPER_ADMIN') return null;

    const employeeAccess = livikEmpId
        ? await prisma.platformEmployeeAccess.findUnique({
            where: { livikEmpId },
            select: { roleAccessId: true, roleAccess: { select: { roleName: true } } },
        })
        : null;
    const roleAccessId = employeeAccess?.roleAccessId ?? null;

    const [grants, rights] = await Promise.all([
        roleAccessId ? resolvePlatformRoleAccessGrants(roleAccessId) : Promise.resolve([]),
        roleAccessId ? resolvePlatformRoleAccessRightNames(roleAccessId) : Promise.resolve([]),
    ]);

    return {
        grants,
        moduleCodes: Array.from(new Set(grants.map((g) => g.moduleCode))),
        rights,
        roleName: employeeAccess?.roleAccess?.roleName ?? null,
    };
}

/**
 * Upserts a PlatformEmployeeAccess row per livikEmpId — creating one (isActive: true) if this is
 * the employee's first-ever LK Space role assignment, else just repointing roleAccessId. This is
 * also what grants them LK Space login at all (see platformAdminService.loginPlatformAdmin).
 */
export async function assignPlatformRoleToEmployees(id: string, input: AssignPlatformRoleAccessInput) {
    const roleAccess = await prisma.platformRoleAccess.findUnique({ where: { id }, select: { id: true } });
    if (!roleAccess) throw new NotFoundError('Role not found', 'PLATFORM_ROLE_ACCESS_NOT_FOUND', { id });

    const livikEmpIds = Array.from(new Set(input.livikEmpIds));
    await prisma.$transaction(
        livikEmpIds.map((livikEmpId) =>
            prisma.platformEmployeeAccess.upsert({
                where: { livikEmpId },
                create: { livikEmpId, roleAccessId: id },
                update: { roleAccessId: id, isActive: true },
            }),
        ),
    );
}

export interface PlatformEmployeeAccessRecord {
    livikEmpId: string;
    roleAccessId: string | null;
    roleName: string | null;
    isActive: boolean;
}

/** Every Livik employee ever granted (or revoked from) LK Space access, with their current role name joined in — backs the "current role" badge on the Users page's Assign Role dialog. */
export async function listPlatformEmployeeAccess(): Promise<PlatformEmployeeAccessRecord[]> {
    const rows = await prisma.platformEmployeeAccess.findMany({
        select: { livikEmpId: true, roleAccessId: true, isActive: true, roleAccess: { select: { roleName: true } } },
    });
    return rows.map((row) => ({
        livikEmpId: row.livikEmpId,
        roleAccessId: row.roleAccessId,
        roleName: row.roleAccess?.roleName ?? null,
        isActive: row.isActive,
    }));
}
