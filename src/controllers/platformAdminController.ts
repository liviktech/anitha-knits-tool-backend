import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import { setPlatformAdminAuthCookies } from '../utils/platformAdminCookie.js';
import { loginPlatformAdmin, signupPlatformAdmin } from '../services/platformAdminService.js';
import { platformAdminLoginSchema, platformAdminSignupSchema } from '../validations/platformAdminValidation.js';
import { signupCompany } from '../services/authService.js';
import { signupSchema } from '../validations/authValidation.js';
import { env } from '../config/env.js';
import { rotatePlatformAdminTokens } from '../utils/platformAdminJwt.js';
import { UnauthorizedError } from '../utils/errors.js';

export const signup = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(platformAdminSignupSchema, req.body);
    const admin = await signupPlatformAdmin(input);
    sendSuccess(res, admin, undefined, 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(platformAdminLoginSchema, req.body);
    const { tokens, admin } = await loginPlatformAdmin(input);
    setPlatformAdminAuthCookies(res, tokens);
    sendSuccess(res, { admin });
});

// Company signup is not public — only an authenticated platform admin can create a company
// (requirePlatformAdmin is applied on this route in platformAdminRoutes.ts).
export const createCompany = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(signupSchema, req.body);
    const result = await signupCompany(input);
    sendSuccess(res, result, undefined, 201);
});

/** Exchanges the platform-admin refresh cookie for a fresh access+refresh pair. */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[env.PLATFORM_ADMIN_REFRESH_COOKIE_NAME];
    if (!refreshToken) {
        throw new UnauthorizedError('Refresh token required', 'AUTH_REQUIRED');
    }
    const tokens = rotatePlatformAdminTokens(refreshToken);
    setPlatformAdminAuthCookies(res, tokens);
    sendSuccess(res, { refreshed: true });
});
