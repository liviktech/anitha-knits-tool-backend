import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import { clearAuthCookies, setAuthCookies } from '../utils/authCookie.js';
import { getCurrentUser, loginUser } from '../services/authService.js';
import { loginSchema } from '../validations/authValidation.js';
import { env } from '../config/env.js';
import { rotateTokens } from '../utils/jwt.js';
import { UnauthorizedError } from '../utils/errors.js';
import { getAuthContext } from '../utils/actor.js';

export const login = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(loginSchema, req.body);
    const { tokens, user, company, access } = await loginUser(input);
    setAuthCookies(res, tokens);
    sendSuccess(res, { user, company, access });
});

/** Exchanges the refresh cookie for a fresh access+refresh pair, extending the session without a re-login. */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[env.JWT_REFRESH_COOKIE_NAME];
    if (!refreshToken) {
        throw new UnauthorizedError('Refresh token required', 'AUTH_REQUIRED');
    }
    const tokens = rotateTokens(refreshToken);
    setAuthCookies(res, tokens);
    sendSuccess(res, { refreshed: true });
});

/** Re-resolves the caller's own profile + access (RoleAccess -> module/tab grants) from scratch. */
export const me = asyncHandler(async (req: Request, res: Response) => {
    const { userId, companyId } = getAuthContext(req);
    const result = await getCurrentUser(userId, companyId);
    sendSuccess(res, result);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
    clearAuthCookies(res);
    sendSuccess(res, { loggedOut: true });
});
