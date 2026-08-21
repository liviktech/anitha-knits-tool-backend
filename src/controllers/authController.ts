import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import { setAuthCookies } from '../utils/authCookie.js';
import { loginUser } from '../services/authService.js';
import { loginSchema } from '../validations/authValidation.js';

export const login = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(loginSchema, req.body);
    const { tokens, user, company } = await loginUser(input);
    setAuthCookies(res, tokens);
    sendSuccess(res, { user, company });
});
