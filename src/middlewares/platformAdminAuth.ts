import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { env } from '../config/env.js';
import { verifyPlatformAdminAccessToken } from '../utils/platformAdminJwt.js';
import { UnauthorizedError } from '../utils/errors.js';

/** Reads the platform-admin access token from its cookie, falling back to `Authorization: Bearer`. Time: O(1); Space: O(1). */
function extractPlatformAdminAccessToken(req: Request): string | undefined {
    const cookieToken = req.cookies?.[env.PLATFORM_ADMIN_ACCESS_COOKIE_NAME];
    if (cookieToken) return cookieToken;

    const header = req.get('authorization');
    if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);

    return undefined;
}

/**
 * Requires a valid platform-admin access token, attaching it to `req.platformAdmin`. Entirely
 * separate from `requireAuth` (company-user sessions) — a company-user token is never accepted
 * here, and vice versa. Stateless JWT verification only, no DB round-trip. Time: O(1); Space: O(1).
 */
export const requirePlatformAdmin: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
    const token = extractPlatformAdminAccessToken(req);
    if (!token) {
        next(new UnauthorizedError('Authentication required', 'AUTH_REQUIRED'));
        return;
    }

    try {
        req.platformAdmin = verifyPlatformAdminAccessToken(token);
        next();
    } catch (err) {
        next(err);
    }
};
