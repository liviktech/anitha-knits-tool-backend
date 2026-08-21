import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from './errors.js';
import { parseDurationMs } from './duration.js';
import type { PlatformAdminRole, PlatformAdminTokenPayload } from '../types/auth.js';

type PlatformAdminClaims = { sub: string; role: PlatformAdminRole; mobile: string };

/** Signs a short-lived platform-admin access token. Time: O(1); Space: O(1). */
export function signPlatformAdminAccessToken(payload: PlatformAdminClaims): string {
    return jwt.sign({ ...payload, type: 'platform_admin_access' }, env.PLATFORM_ADMIN_JWT_SECRET, {
        expiresIn: Math.floor(parseDurationMs(env.PLATFORM_ADMIN_JWT_EXPIRES_IN) / 1000),
    });
}

/** Signs a longer-lived platform-admin refresh token, keyed with a separate secret from the access token. Time: O(1); Space: O(1). */
export function signPlatformAdminRefreshToken(payload: PlatformAdminClaims): string {
    return jwt.sign({ ...payload, type: 'platform_admin_refresh' }, env.PLATFORM_ADMIN_JWT_REFRESH_SECRET, {
        expiresIn: Math.floor(parseDurationMs(env.PLATFORM_ADMIN_JWT_REFRESH_EXPIRES_IN) / 1000),
    });
}

/** Verifies a platform-admin access token and rejects a refresh token presented in its place. Time: O(1); Space: O(1). */
export function verifyPlatformAdminAccessToken(token: string): PlatformAdminTokenPayload {
    const decoded = verifyWithSecret(token, env.PLATFORM_ADMIN_JWT_SECRET);
    if (decoded.type !== 'platform_admin_access') {
        throw new UnauthorizedError('Invalid token', 'AUTH_TOKEN_INVALID');
    }
    return decoded;
}

/** Verifies a platform-admin refresh token and rejects an access token presented in its place. Time: O(1); Space: O(1). */
export function verifyPlatformAdminRefreshToken(token: string): PlatformAdminTokenPayload {
    const decoded = verifyWithSecret(token, env.PLATFORM_ADMIN_JWT_REFRESH_SECRET);
    if (decoded.type !== 'platform_admin_refresh') {
        throw new UnauthorizedError('Invalid token', 'AUTH_TOKEN_INVALID');
    }
    return decoded;
}

/** Verifies a platform-admin refresh token and issues a fresh access+refresh pair off the same claims. Time: O(1); Space: O(1). */
export function rotatePlatformAdminTokens(refreshToken: string): { accessToken: string; refreshToken: string } {
    const { sub, role, mobile } = verifyPlatformAdminRefreshToken(refreshToken);
    const payload: PlatformAdminClaims = { sub, role, mobile };
    return {
        accessToken: signPlatformAdminAccessToken(payload),
        refreshToken: signPlatformAdminRefreshToken(payload),
    };
}

function verifyWithSecret(token: string, secret: string): PlatformAdminTokenPayload {
    try {
        return jwt.verify(token, secret) as PlatformAdminTokenPayload;
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            throw new UnauthorizedError('Token expired', 'AUTH_TOKEN_EXPIRED');
        }
        throw new UnauthorizedError('Invalid token', 'AUTH_TOKEN_INVALID');
    }
}
