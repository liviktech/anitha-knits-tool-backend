import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import type { Role } from '../types/auth.js';

/** Reads the access token from the auth cookie, falling back to `Authorization: Bearer`. Time: O(1); Space: O(1). */
function extractAccessToken(req: Request): string | undefined {
    const cookieToken = req.cookies?.[env.JWT_COOKIE_NAME];
    if (cookieToken) return cookieToken;

    const header = req.get('authorization');
    if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);

    return undefined;
}

/**
 * Requires a valid access token; with roles given, also requires `req.user.role` to be one of them.
 * Usage: `requireAuth()` for any authenticated user, `requireAuth('ADMIN', 'MANAGER')` to restrict by role.
 * Stateless JWT verification only, no DB round-trip. Time: O(1); Space: O(1).
 */
export function requireAuth(...allowedRoles: Role[]): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction) => {
        const token = extractAccessToken(req);
        if (!token) {
            next(new UnauthorizedError('Authentication required', 'AUTH_REQUIRED'));
            return;
        }

        try {
            const payload = verifyAccessToken(token);
            if (allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
                next(new ForbiddenError('You do not have permission to access this resource'));
                return;
            }
            req.user = payload;
            next();
        } catch (err) {
            next(err);
        }
    };
}

/**
 * Attaches `req.user` when a valid access token is present; never blocks the request otherwise
 * (missing, invalid, or expired tokens all fall through as anonymous). Time: O(1); Space: O(1).
 */
export const optionalAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
    const token = extractAccessToken(req);
    if (!token) {
        next();
        return;
    }

    try {
        req.user = verifyAccessToken(token);
    } catch {
        // Invalid/expired token on an optional route: proceed anonymously rather than blocking.
    }
    next();
};
