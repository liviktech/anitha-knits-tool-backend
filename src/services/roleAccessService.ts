import { isUniqueViolation } from '../db/errors.js';
import { withTransaction } from '../db/transaction.js';
import { RightAction, UserRole } from '../types/enums.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import {
    bulkAssignRoleAccessToUsers,
    countRightsMatching,
    countUsersMatching,
    deleteRoleAccessRights,
    deleteRoleAccessRow,
    existsRoleAccessInCompany,
    existsRoleAccessRightMatch,
    findRoleAccessById,
    findRoleAccessByIdTx,
    findUserRoleAccessId,
    insertRoleAccess,
    insertRoleAccessRights,
    listRoleAccesses as listRoleAccessesRepo,
    resolveRoleAccessGrants as resolveRoleAccessGrantsRepo,
    resolveRoleAccessRightNames as resolveRoleAccessRightNamesRepo,
    updateRoleAccessRow,
    type RoleAccessRow,
} from '../repositories/roleAccess.repository.js';
import type {
    AssignRoleAccessInput,
    CreateRoleAccessInput,
    ListRoleAccessQuery,
    UpdateRoleAccessInput,
} from '../validations/roleAccessValidation.js';

function mapRoleAccessRecord(record: RoleAccessRow) {
    const { rightIds, ...rest } = record;
    return { ...rest, rightIds };
}

/** Throws if any id in rightIds doesn't belong to a Right owned by this company. */
async function assertRightsInCompany(rightIds: string[], companyId: string) {
    if (rightIds.length === 0) return;
    const count = await countRightsMatching(rightIds, companyId);
    if (count !== rightIds.length) {
        throw new ValidationError('One or more rightIds do not reference an existing right for this company', 'INVALID_RIGHT_ID');
    }
}

/** Maps a unique-constraint violation on [companyId, roleName] to a stable conflict error. */
function mapRoleNameConflict(err: unknown): never | undefined {
    if (!isUniqueViolation(err)) return undefined;
    throw new ConflictError('A role with this name already exists', 'ROLE_NAME_EXISTS');
}

export async function createRoleAccess(input: CreateRoleAccessInput, companyId: string) {
    const rightIds = Array.from(new Set(input.rightIds));
    await assertRightsInCompany(rightIds, companyId);

    try {
        const record = await withTransaction(async (client) => {
            const created = await insertRoleAccess(client, { companyId, roleName: input.roleName, description: input.description });
            if (rightIds.length > 0) {
                await insertRoleAccessRights(client, created.id, rightIds);
            }
            return findRoleAccessByIdTx(client, created.id);
        });

        return mapRoleAccessRecord(record);
    } catch (err) {
        mapRoleNameConflict(err);
        throw err;
    }
}

export async function listRoleAccesses(query: ListRoleAccessQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await listRoleAccessesRepo(companyId, { name: query.name }, skip, take);
    return { items: rows.map(mapRoleAccessRecord), meta: toPageMeta(query, total) };
}

export async function getRoleAccessById(id: string, companyId: string) {
    const record = await findRoleAccessById(id, companyId);
    if (!record) throw new NotFoundError('Role not found', 'ROLE_ACCESS_NOT_FOUND', { id });
    return mapRoleAccessRecord(record);
}

export async function updateRoleAccess(id: string, input: UpdateRoleAccessInput, companyId: string) {
    const existing = await existsRoleAccessInCompany(id, companyId);
    if (!existing) throw new NotFoundError('Role not found', 'ROLE_ACCESS_NOT_FOUND', { id });

    const rightIds = input.rightIds !== undefined ? Array.from(new Set(input.rightIds)) : undefined;
    if (rightIds !== undefined) {
        await assertRightsInCompany(rightIds, companyId);
    }

    try {
        const record = await withTransaction(async (client) => {
            await updateRoleAccessRow(client, id, { roleName: input.roleName, description: input.description });

            if (rightIds !== undefined) {
                await deleteRoleAccessRights(client, id);
                if (rightIds.length > 0) {
                    await insertRoleAccessRights(client, id, rightIds);
                }
            }

            return findRoleAccessByIdTx(client, id);
        });

        return mapRoleAccessRecord(record);
    } catch (err) {
        mapRoleNameConflict(err);
        throw err;
    }
}

export async function deleteRoleAccess(id: string, companyId: string) {
    const existing = await existsRoleAccessInCompany(id, companyId);
    if (!existing) throw new NotFoundError('Role not found', 'ROLE_ACCESS_NOT_FOUND', { id });

    // RoleAccessRight rows cascade-delete; any User.roleAccessId pointing here is SetNull (schema).
    await deleteRoleAccessRow(id);
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
    return resolveRoleAccessGrantsRepo(roleAccessId, companyId);
}

export interface UserAccess {
    grants: AccessGrant[];
    moduleCodes: string[];
    /** Every rightName this user's assigned RoleAccess grants — lets the frontend answer can(rightName) without a DB round trip. Empty (not missing) when no RoleAccess is assigned. */
    rights: string[];
}

/** Resolves just the rightName strings a RoleAccess grants — the raw list backing UserAccess.rights. */
async function resolveRoleAccessRightNames(roleAccessId: string, companyId: string): Promise<string[]> {
    return resolveRoleAccessRightNamesRepo(roleAccessId, companyId);
}

/**
 * The single source of truth for "what can this user see" — used by both the login//me
 * response (authService) and the requireModuleAccess route middleware, so the two can never
 * drift out of sync with each other.
 *
 * `null` = unrestricted (every module/tab, every right) — ADMIN only, always.
 * Everyone else defaults to ZERO access with no RoleAccess assigned (not the old "no
 * assignment = full access" fallback) — access must be explicitly granted, except:
 *
 * MANAGER gets a built-in, unconditional view-only grant for `productiondetails` — not
 * dependent on any Right, and not lost even if their assigned RoleAccess grants nothing for
 * that module. (Manager's *edit* ability on Production Details still requires the
 * PRODUCTION_DETAILS_EDIT_UNAPPROVED right, checked separately via userHasModuleAction — this
 * function only ever answers "can they see it", never "can they mutate it". The `rights` list
 * below reflects only explicitly-assigned rights — it does NOT include this view-only carve-out.)
 */
export async function resolveUserAccess(role: UserRole, roleAccessId: string | null, companyId: string): Promise<UserAccess | null> {
    if (role === UserRole.ADMIN) return null;

    const [grants, rights] = await Promise.all([
        roleAccessId ? resolveRoleAccessGrants(roleAccessId, companyId) : Promise.resolve([]),
        roleAccessId ? resolveRoleAccessRightNames(roleAccessId, companyId) : Promise.resolve([]),
    ]);

    if (role === UserRole.MANAGER && !grants.some((g) => g.moduleCode === 'productiondetails')) {
        grants.push({ moduleCode: 'productiondetails', tabCode: null });
    }

    return { grants, moduleCodes: Array.from(new Set(grants.map((g) => g.moduleCode))), rights };
}

/**
 * Whether the caller's assigned RoleAccess includes a right granting `action` on `moduleCode`
 * — independent of the module/tab *visibility* grants in resolveUserAccess above. Used for hard
 * ceiling checks (e.g. "does this Supervisor hold an ADD right for productiondetails"), which
 * need to know about a specific action (View/Add/Edit/Delete), not just "can they see it".
 * Always false with no RoleAccess assigned — there is no default-grant carve-out here, unlike
 * resolveUserAccess's Manager view default.
 *
 * `tabCode`, when given, only matches a right scoped to that exact tab OR one scoped to the
 * whole module (tabId null) — a right an admin scoped to a *different* tab of the same module
 * (e.g. Employees > Payroll) must not satisfy a check for another tab (e.g. Employees > Directory).
 * Omit it for modules with no tabs (e.g. Production Details, Inventory).
 */
export async function userHasModuleAction(
    userId: string,
    companyId: string,
    moduleCode: string,
    action: RightAction,
    tabCode?: string,
): Promise<boolean> {
    const roleAccessId = await findUserRoleAccessId(userId, companyId);
    if (!roleAccessId) return false;

    return existsRoleAccessRightMatch(roleAccessId, companyId, moduleCode, action, tabCode);
}

/**
 * Generic hard-ceiling helper for modules with no special business rules beyond "ADMIN always,
 * everyone else needs the specific right" (Employees, Inventory). Production Details keeps its
 * own richer ceilings in productionCeilings.ts (approval lock, admin-only delete, etc.) — this
 * is deliberately not used there.
 */
export async function assertModuleActionAllowed(
    role: UserRole,
    callerId: string,
    companyId: string,
    moduleCode: string,
    action: RightAction,
    tabCode?: string,
): Promise<void> {
    if (role === UserRole.ADMIN) return;

    const allowed = await userHasModuleAction(callerId, companyId, moduleCode, action, tabCode);
    if (!allowed) {
        throw new ForbiddenError('You do not have permission to perform this action', 'ACTION_NOT_GRANTED');
    }
}

export async function assignRoleAccessToEmployees(id: string, input: AssignRoleAccessInput, companyId: string) {
    const roleAccess = await existsRoleAccessInCompany(id, companyId);
    if (!roleAccess) throw new NotFoundError('Role not found', 'ROLE_ACCESS_NOT_FOUND', { id });

    const employeeIds = Array.from(new Set(input.employeeIds));
    const employeeCount = await countUsersMatching(employeeIds, companyId);
    if (employeeCount !== employeeIds.length) {
        throw new ValidationError('One or more employeeIds do not reference an existing employee for this company', 'INVALID_EMPLOYEE_ID');
    }

    await bulkAssignRoleAccessToUsers(employeeIds, companyId, id);
}
