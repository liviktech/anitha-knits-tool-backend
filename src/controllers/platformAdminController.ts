import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import { setPlatformAdminAuthCookies } from '../utils/platformAdminCookie.js';
import { loginPlatformAdmin, signupPlatformAdmin } from '../services/platformAdminService.js';
import { platformAdminLoginSchema, platformAdminSignupSchema } from '../validations/platformAdminValidation.js';
import { signupCompany } from '../services/authService.js';
import { signupSchema } from '../validations/authValidation.js';

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
