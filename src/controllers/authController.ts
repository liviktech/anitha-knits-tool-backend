import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import { clearAuthCookies, setAuthCookies } from '../utils/authCookie.js';
import {
    getCurrentUser,
    loginUser,
    loginUserWithOtp,
    resetUserPassword,
} from '../services/authService.js';
import { issueResetToken, requestOtp, verifyOtp } from '../services/otpService.js';
import {
    loginSchema,
    requestOtpSchema,
    resetPasswordSchema,
    verifyOtpLoginSchema,
    verifyOtpResetSchema,
} from '../validations/authValidation.js';
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

/** Requests an OTP for OTP-based login. Purpose is hardcoded here, never client-supplied. */
export const requestOtpLogin = asyncHandler(async (req: Request, res: Response) => {
    const { mobile } = parseOrThrow(requestOtpSchema, req.body);
    await requestOtp({ mobile, purpose: 'LOGIN', actorType: 'COMPANY_USER' });
    // Deliberately generic — never reveals whether this mobile number is registered.
    sendSuccess(res, { message: 'If this mobile number is registered, an OTP has been sent' });
});

/** Requests an OTP to start the forgot-password flow. Purpose is hardcoded here. */
export const requestPasswordResetOtp = asyncHandler(async (req: Request, res: Response) => {
    const { mobile } = parseOrThrow(requestOtpSchema, req.body);
    await requestOtp({ mobile, purpose: 'RESET_PASSWORD', actorType: 'COMPANY_USER' });
    sendSuccess(res, { message: 'If this mobile number is registered, an OTP has been sent' });
});

/** Verifies a LOGIN OTP and, on success, signs in exactly like POST /login. */
export const verifyOtpLogin = asyncHandler(async (req: Request, res: Response) => {
    const { mobile, otp } = parseOrThrow(verifyOtpLoginSchema, req.body);
    await verifyOtp({ mobile, otp, purpose: 'LOGIN', actorType: 'COMPANY_USER' });
    const { tokens, user, company, access } = await loginUserWithOtp(mobile);
    setAuthCookies(res, tokens);
    sendSuccess(res, { user, company, access });
});

/** Verifies a RESET_PASSWORD OTP and returns a short-lived resetToken for POST /password/reset. */
export const verifyPasswordResetOtp = asyncHandler(async (req: Request, res: Response) => {
    const { mobile, otp } = parseOrThrow(verifyOtpResetSchema, req.body);
    await verifyOtp({ mobile, otp, purpose: 'RESET_PASSWORD', actorType: 'COMPANY_USER' });
    const resetToken = issueResetToken({ mobile, actorType: 'COMPANY_USER' });
    sendSuccess(res, { resetToken });
});

/** Completes the forgot-password flow using the resetToken from verifyPasswordResetOtp. */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { mobile, resetToken, newPassword } = parseOrThrow(resetPasswordSchema, req.body);
    await resetUserPassword(mobile, resetToken, newPassword);
    sendSuccess(res, { passwordReset: true });
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
