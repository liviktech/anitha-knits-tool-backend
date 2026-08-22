import type { Response } from 'express';
import { env, isProduction } from '../config/env.js';
import { parseDurationMs } from './duration.js';

// See authCookie.ts: frontend/backend are cross-site in prod (different
// vercel.app subdomains), which requires SameSite=None + Secure for the
// cookie to survive the cross-site fetch.
const COOKIE_BASE_OPTIONS = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ('none' as const) : ('lax' as const),
    path: '/',
};

/** Sets the platform-admin access+refresh httpOnly cookies, separate from the company-user ones. */
export function setPlatformAdminAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }): void {
    res.cookie(env.PLATFORM_ADMIN_ACCESS_COOKIE_NAME, tokens.accessToken, {
        ...COOKIE_BASE_OPTIONS,
        maxAge: parseDurationMs(env.PLATFORM_ADMIN_JWT_EXPIRES_IN),
    });
    res.cookie(env.PLATFORM_ADMIN_REFRESH_COOKIE_NAME, tokens.refreshToken, {
        ...COOKIE_BASE_OPTIONS,
        maxAge: parseDurationMs(env.PLATFORM_ADMIN_JWT_REFRESH_EXPIRES_IN),
    });
}

/** Clears both platform-admin auth cookies (logout). */
export function clearPlatformAdminAuthCookies(res: Response): void {
    res.clearCookie(env.PLATFORM_ADMIN_ACCESS_COOKIE_NAME, { path: COOKIE_BASE_OPTIONS.path });
    res.clearCookie(env.PLATFORM_ADMIN_REFRESH_COOKIE_NAME, { path: COOKIE_BASE_OPTIONS.path });
}
