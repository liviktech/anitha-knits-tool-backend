import { RightAction, UserRole } from '@prisma/client';
import { ForbiddenError } from '../utils/errors.js';
import { userHasModuleAction } from './roleAccessService.js';

/**
 * Hard role ceilings for Production Details (Extruder/Looms/Fabric Checking), layered on top
 * of (not replacing) the generic Right/RoleAccess grant system — these can never be exceeded
 * even if an admin mistakenly assigns a broader Right, because they're checked here in the
 * service layer regardless of what the caller's RoleAccess otherwise grants.
 *
 *   ADMIN      unrestricted — create, edit (any), delete, approve.
 *   MANAGER    view always (see roleAccessService.resolveUserAccess); edit only an unapproved
 *              record, and only with an EDIT right on the productiondetails module; never
 *              create, never delete.
 *   SUPERVISOR create only, and only with an ADD right on the productiondetails module; never
 *              edit, never delete, regardless of any right assigned.
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

    if (role === UserRole.MANAGER) {
        throw new ForbiddenError('Managers cannot create production records', 'MANAGER_CANNOT_CREATE');
    }

    const canCreate = await userHasModuleAction(callerId, companyId, PRODUCTION_DETAILS_MODULE_CODE, RightAction.ADD);
    if (!canCreate) {
        throw new ForbiddenError('You do not have permission to create production records', 'SUPERVISOR_ENTRY_NOT_GRANTED');
    }
}

export async function assertCanUpdateProductionRecord(
    role: UserRole,
    callerId: string,
    companyId: string,
    isApproved: boolean,
): Promise<void> {
    if (role === UserRole.ADMIN) return;

    if (role === UserRole.SUPERVISOR) {
        throw new ForbiddenError('Supervisors cannot edit production records', 'SUPERVISOR_CANNOT_EDIT');
    }

    if (isApproved) {
        throw new ForbiddenError('Cannot edit an approved production record', 'RECORD_ALREADY_APPROVED');
    }

    const canEdit = await userHasModuleAction(callerId, companyId, PRODUCTION_DETAILS_MODULE_CODE, RightAction.EDIT);
    if (!canEdit) {
        throw new ForbiddenError('You do not have permission to edit production records', 'MANAGER_EDIT_NOT_GRANTED');
    }
}

export function assertCanDeleteProductionRecord(role: UserRole): void {
    if (role !== UserRole.ADMIN) {
        throw new ForbiddenError('Only an admin can delete production records', 'DELETE_ADMIN_ONLY');
    }
}
