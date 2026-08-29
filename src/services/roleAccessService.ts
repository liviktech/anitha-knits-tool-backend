import { Prisma, RightAction, UserRole } from '@prisma/client';
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

export interface UserAccess {
    grants: AccessGrant[];
    moduleCodes: string[];
}

/**
 * The single source of truth for "what can this user see" — used by both the login//me
 * response (authService) and the requireModuleAccess route middleware, so the two can never
 * drift out of sync with each other.
 *
 * `null` = unrestricted (every module/tab) — ADMIN only, always.
 * Everyone else defaults to ZERO access with no RoleAccess assigned (not the old "no
 * assignment = full access" fallback) — access must be explicitly granted, except:
 *
 * MANAGER gets a built-in, unconditional view-only grant for `productiondetails` — not
 * dependent on any Right, and not lost even if their assigned RoleAccess grants nothing for
 * that module. (Manager's *edit* ability on Production Details still requires the
 * PRODUCTION_DETAILS_EDIT_UNAPPROVED right, checked separately via userHasRight — this
 * function only ever answers "can they see it", never "can they mutate it".)
 */
export async function resolveUserAccess(role: UserRole, roleAccessId: string | null, companyId: string): Promise<UserAccess | null> {
    if (role === UserRole.ADMIN) return null;

    const grants = roleAccessId ? await resolveRoleAccessGrants(roleAccessId, companyId) : [];

    if (role === UserRole.MANAGER && !grants.some((g) => g.moduleCode === 'productiondetails')) {
        grants.push({ moduleCode: 'productiondetails', tabCode: null });
    }

    return { grants, moduleCodes: Array.from(new Set(grants.map((g) => g.moduleCode))) };
}

/**
 * Whether the caller's assigned RoleAccess includes a right granting `action` on `moduleCode`
 * — independent of the module/tab *visibility* grants in resolveUserAccess above. Used for hard
 * ceiling checks (e.g. "does this Supervisor hold an ADD right for productiondetails"), which
 * need to know about a specific action (View/Add/Edit/Delete), not just "can they see it".
 * Always false with no RoleAccess assigned — there is no default-grant carve-out here, unlike
 * resolveUserAccess's Manager view default.
 */
export async function userHasModuleAction(userId: string, companyId: string, moduleCode: string, action: RightAction): Promise<boolean> {
    const user = await prisma.user.findFirst({ where: { id: userId, companyId }, select: { roleAccessId: true } });
    if (!user?.roleAccessId) return false;

    const match = await prisma.roleAccessRight.findFirst({
        where: { roleAccessId: user.roleAccessId, right: { companyId, action, module: { moduleCode } } },
        select: { id: true },
    });
    return !!match;
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
