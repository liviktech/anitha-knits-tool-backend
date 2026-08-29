import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { resolveRoleAccessGrants } from '../services/roleAccessService.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

/**
 * Gates a route by the caller's resolved RoleAccess grants (moduleCode, optionally tabCode) —
 * not the coarse UserRole enum requireAuth() checks. Must run after requireAuth().
 *
 * - ADMIN always passes (mirrors the frontend: an admin managing the permission system
 *   shouldn't be able to lock themselves out).
 * - Anyone else with no RoleAccess assigned yet also passes — unrestricted, same "no
 *   assignment = full access" default used everywhere else in this feature.
 * - Otherwise the caller's RoleAccess must grant at least one of `moduleCode` (a single code,
 *   or an any-of array — some endpoints legitimately back more than one frontend module, e.g.
 *   GET /dashboard/production also feeds the Production module's Day Wise Report); if `tabCode`
 *   is given, a module-wide grant (no specific tab) still counts as access to every tab in it.
 */
export function requireModuleAccess(moduleCode: string | string[], tabCode?: string): RequestHandler {
    const moduleCodes = Array.isArray(moduleCode) ? moduleCode : [moduleCode];

    return async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user) {
            next(new UnauthorizedError('Authentication required', 'AUTH_REQUIRED'));
            return;
        }
        if (req.user.role === 'ADMIN') {
            next();
            return;
        }

        try {
            const user = await prisma.user.findFirst({
                where: { id: req.user.sub, companyId: req.user.companyId },
                select: { roleAccessId: true },
            });
            if (!user?.roleAccessId) {
                next();
                return;
            }

            const grants = await resolveRoleAccessGrants(user.roleAccessId, req.user.companyId);
            const allowed = grants.some(
                (g) => moduleCodes.includes(g.moduleCode) && (!tabCode || g.tabCode === tabCode || g.tabCode === null),
            );
            if (!allowed) {
                next(new ForbiddenError('You do not have access to this module', 'MODULE_ACCESS_DENIED'));
                return;
            }
            next();
        } catch (err) {
            next(err);
        }
    };
}
