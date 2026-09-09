import { RightAction, UserRole } from '../types/enums.js';
import { ForbiddenError } from '../utils/errors.js';
import { userHasModuleAction } from './roleAccessService.js';

/**
 * Role ceilings for Production Details (Extruder/Looms/Fabric Checking), layered on top of the
 * generic Right/RoleAccess grant system — checked here in the service layer regardless of what
 * the caller's RoleAccess otherwise grants.
 *
 *   ADMIN      unrestricted — create, edit (any), delete, approve.
 *   MANAGER    view always (see roleAccessService.resolveUserAccess); create with an ADD right,
 *              edit an unapproved record with an EDIT right (matches the PRD: "Manager — create,
 *              manage, review, approve, or reject production entries"); never delete.
 *   SUPERVISOR create with an ADD right, edit an unapproved record with an EDIT right (PRD:
 *              "Supervisor — create and edit production entries"); never delete.
 *
 * The ADD/EDIT rights checked here are plain, admin-created Rights (Module=Production Details,
 * Action=Add/Edit) like any other — nothing is auto-seeded; an admin must explicitly create and
 * assign them via the Roles tab for a Supervisor/Manager to gain create/edit ability at all.
 *
 * Approve is not checked here — it's ADMIN-only at the route level (requireAuth('ADMIN')) and
 * not exposed through the Right/RoleAccess system at all.
 */

const PRODUCTION_DETAILS_MODULE_CODE = 'productiondetails';

export async function assertCanCreateProductionRecord(role: UserRole, callerId: string, companyId: string): Promise<void> {
    if (role === UserRole.ADMIN) return;

    const canCreate = await userHasModuleAction(callerId, companyId, PRODUCTION_DETAILS_MODULE_CODE, RightAction.ADD);
    if (!canCreate) {
        throw new ForbiddenError('You do not have permission to create production records', 'PRODUCTION_ENTRY_NOT_GRANTED');
    }
}

export async function assertCanUpdateProductionRecord(
    role: UserRole,
    callerId: string,
    companyId: string,
    isApproved: boolean,
): Promise<void> {
    if (role === UserRole.ADMIN) return;

    if (isApproved) {
        throw new ForbiddenError('Cannot edit an approved production record', 'RECORD_ALREADY_APPROVED');
    }

    const canEdit = await userHasModuleAction(callerId, companyId, PRODUCTION_DETAILS_MODULE_CODE, RightAction.EDIT);
    if (!canEdit) {
        throw new ForbiddenError('You do not have permission to edit production records', 'PRODUCTION_EDIT_NOT_GRANTED');
    }
}

export function assertCanDeleteProductionRecord(role: UserRole): void {
    if (role !== UserRole.ADMIN) {
        throw new ForbiddenError('Only an admin can delete production records', 'DELETE_ADMIN_ONLY');
    }
}
