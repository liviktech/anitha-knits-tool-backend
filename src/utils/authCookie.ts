import type { Response } from 'express';
import { env, isProduction } from '../config/env.js';
import { parseDurationMs } from './duration.js';

// Frontend and backend are deployed on different vercel.app subdomains, which
// browsers treat as different sites — a cross-site fetch only carries the
// cookie if it's SameSite=None (which in turn requires Secure). Locally both
// run on localhost (same site regardless of port), so Lax + non-Secure works.
const COOKIE_BASE_OPTIONS = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ('none' as const) : ('lax' as const),
};

// Scoped to the refresh route itself so the refresh token isn't sent on every request.
const REFRESH_COOKIE_PATH = '/api/v1/company/auth/refresh';

/** Sets the access+refresh httpOnly cookies. httpOnly blocks XSS token theft. */
export function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }): void {
    res.cookie(env.JWT_COOKIE_NAME, tokens.accessToken, {
        ...COOKIE_BASE_OPTIONS,
        path: '/',
        maxAge: parseDurationMs(env.JWT_EXPIRES_IN),
    });
    res.cookie(env.JWT_REFRESH_COOKIE_NAME, tokens.refreshToken, {
        ...COOKIE_BASE_OPTIONS,
        path: REFRESH_COOKIE_PATH,
        maxAge: parseDurationMs(env.JWT_REFRESH_EXPIRES_IN),
    });
}

/** Clears both auth cookies (logout). */
export function clearAuthCookies(res: Response): void {
    res.clearCookie(env.JWT_COOKIE_NAME, { path: '/' });
    res.clearCookie(env.JWT_REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}
