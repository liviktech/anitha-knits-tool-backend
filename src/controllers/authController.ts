import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import { signupCompany } from '../services/authService.js';
import { signupSchema } from '../validations/authValidation.js';

export const signup = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(signupSchema, req.body);
    const result = await signupCompany(input);
    sendSuccess(res, result, undefined, 201);
});
