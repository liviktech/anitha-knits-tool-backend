import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { resolveUserAccess } from '../services/roleAccessService.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

/**
 * Gates a route by the caller's resolved RoleAccess grants (moduleCode, optionally tabCode) —
 * not the coarse UserRole enum requireAuth() checks. Must run after requireAuth().
 *
 * Delegates entirely to roleAccessService.resolveUserAccess — the same resolver the
 * login//me response uses — so route enforcement and what the frontend sidebar shows can
 * never drift out of sync. See that function's doc comment for the exact default-deny +
 * Manager view-carve-out semantics (ADMIN unrestricted; everyone else denied by default
 * unless explicitly granted, except Manager's built-in productiondetails view).
 */
export function requireModuleAccess(moduleCode: string | string[], tabCode?: string): RequestHandler {
    const moduleCodes = Array.isArray(moduleCode) ? moduleCode : [moduleCode];

    return async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user) {
            next(new UnauthorizedError('Authentication required', 'AUTH_REQUIRED'));
            return;
        }

        try {
            const user = await prisma.user.findFirst({
                where: { id: req.user.sub, companyId: req.user.companyId },
                select: { role: true, roleAccessId: true },
            });
            if (!user) {
                next(new UnauthorizedError('Authentication required', 'AUTH_REQUIRED'));
                return;
            }

            const access = await resolveUserAccess(user.role, user.roleAccessId, req.user.companyId);
            if (access === null) {
                next(); // unrestricted (ADMIN)
                return;
            }

            const allowed = access.grants.some(
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
