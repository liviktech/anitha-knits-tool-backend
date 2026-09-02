import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { resolvePlatformAccess } from '../services/platformRoleAccessService.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

/**
 * Gates a route by the caller's resolved LK Space access (moduleCode, optionally tabCode) — the
 * platform-admin mirror of requireModuleAccess.ts. Must run after requirePlatformAdmin().
 *
 * Re-resolves live on every request (not from the JWT) via resolvePlatformAccess — the same
 * resolver the login/me response uses, so route enforcement and what the frontend nav shows can
 * never drift apart. SUPER_ADMIN is always unrestricted; an EMPLOYEE is denied by default unless
 * their assigned PlatformRoleAccess explicitly grants this module (+ tab).
 */
export function requirePlatformModuleAccess(moduleCode: string | string[], tabCode?: string): RequestHandler {
    const moduleCodes = Array.isArray(moduleCode) ? moduleCode : [moduleCode];

    return async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.platformAdmin) {
            next(new UnauthorizedError('Authentication required', 'AUTH_REQUIRED'));
            return;
        }

        try {
            const { role, sub } = req.platformAdmin;
            const access = await resolvePlatformAccess(role, role === 'EMPLOYEE' ? sub : null);
            if (access === null) {
                next(); // unrestricted (SUPER_ADMIN)
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
