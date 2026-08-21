import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from './errors.js';
import { parseDurationMs } from './duration.js';
import type { AccessTokenPayload, RefreshTokenPayload, TokenPayload } from '../types/auth.js';

/** Signs a short-lived access token carrying role/companyId/mobile. Time: O(1); Space: O(1). */
export function signAccessToken(payload: TokenPayload): string {
    return jwt.sign({ ...payload, type: 'access' }, env.JWT_SECRET, {
        expiresIn: Math.floor(parseDurationMs(env.JWT_EXPIRES_IN) / 1000),
    });
}

/** Signs a longer-lived refresh token, keyed with a separate secret from the access token. Time: O(1); Space: O(1). */
export function signRefreshToken(payload: TokenPayload): string {
    return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
        expiresIn: Math.floor(parseDurationMs(env.JWT_REFRESH_EXPIRES_IN) / 1000),
    });
}

/** Verifies an access token and rejects refresh tokens presented in its place. Time: O(1); Space: O(1). */
export function verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = verifyWithSecret(token, env.JWT_SECRET);
    if (decoded.type !== 'access') {
        throw new UnauthorizedError('Invalid token', 'AUTH_TOKEN_INVALID');
    }
    return decoded as AccessTokenPayload;
}

/** Verifies a refresh token and rejects access tokens presented in its place. Time: O(1); Space: O(1). */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
    const decoded = verifyWithSecret(token, env.JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') {
        throw new UnauthorizedError('Invalid token', 'AUTH_TOKEN_INVALID');
    }
    return decoded as RefreshTokenPayload;
}

/** Verifies a refresh token and issues a fresh access+refresh pair off the same claims. Time: O(1); Space: O(1). */
export function rotateTokens(refreshToken: string): { accessToken: string; refreshToken: string } {
    const { sub, role, companyId, mobile } = verifyRefreshToken(refreshToken);
    const payload: TokenPayload = { sub, role, companyId, mobile };
    return {
        accessToken: signAccessToken(payload),
        refreshToken: signRefreshToken(payload),
    };
}

function verifyWithSecret(token: string, secret: string): TokenPayload & { type: 'access' | 'refresh' } {
    try {
        return jwt.verify(token, secret) as TokenPayload & { type: 'access' | 'refresh' };
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            throw new UnauthorizedError('Token expired', 'AUTH_TOKEN_EXPIRED');
        }
        throw new UnauthorizedError('Invalid token', 'AUTH_TOKEN_INVALID');
    }
}
