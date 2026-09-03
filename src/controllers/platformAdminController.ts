import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import { clearPlatformAdminAuthCookies, setPlatformAdminAuthCookies } from '../utils/platformAdminCookie.js';
import {
    loginPlatformAdmin,
    loginPlatformAdminWithOtp,
    resetPlatformAdminPassword,
    signupPlatformAdmin,
} from '../services/platformAdminService.js';
import { issueResetToken, requestOtp, verifyOtp } from '../services/otpService.js';
import {
    platformAdminLoginSchema,
    platformAdminRequestOtpSchema,
    platformAdminResetPasswordSchema,
    platformAdminSignupSchema,
    platformAdminVerifyOtpLoginSchema,
    platformAdminVerifyOtpResetSchema,
} from '../validations/platformAdminValidation.js';
import { getCompanyById, listCompanies, listCompanyUsers, signupCompany, updateCompany } from '../services/authService.js';
import {
    companyIdParamsSchema,
    listCompaniesQuerySchema,
    listCompanyUsersQuerySchema,
    signupSchema,
    updateCompanySchema,
} from '../validations/authValidation.js';
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
    const { tokens, admin, access } = await loginPlatformAdmin(input);
    setPlatformAdminAuthCookies(res, tokens);
    sendSuccess(res, { admin, access });
});

/** Re-resolves the caller's own LK Space profile + access (PlatformRoleAccess -> module grants) from scratch. */
export const me = asyncHandler(async (req: Request, res: Response) => {
    if (!req.platformAdmin) throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
    const result = await getCurrentPlatformAdmin(req.platformAdmin.role, req.platformAdmin.sub);
    sendSuccess(res, result);
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

export const listCompaniesHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listCompaniesQuerySchema, req.query);
    const { items, meta } = await listCompanies(query);
    sendSuccess(res, items, meta);
});

export const getCompanyHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(companyIdParamsSchema, req.params);
    const company = await getCompanyById(id);
    sendSuccess(res, company);
});

export const updateCompanyHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(companyIdParamsSchema, req.params);
    const input = parseOrThrow(updateCompanySchema, req.body);
    const company = await updateCompany(id, input);
    sendSuccess(res, company);
});

export const listCompanyUsersHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(companyIdParamsSchema, req.params);
    const query = parseOrThrow(listCompanyUsersQuerySchema, req.query);
    const { items, meta } = await listCompanyUsers(id, query);
    sendSuccess(res, items, meta);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
    clearPlatformAdminAuthCookies(res);
    sendSuccess(res, { loggedOut: true });
});

/** Requests an OTP for OTP-based platform-admin login. Purpose is hardcoded here. */
export const requestOtpLogin = asyncHandler(async (req: Request, res: Response) => {
    const { mobile } = parseOrThrow(platformAdminRequestOtpSchema, req.body);
    await requestOtp({ mobile, purpose: 'LOGIN', actorType: 'PLATFORM_ADMIN' });
    sendSuccess(res, { message: 'If this mobile number is registered, an OTP has been sent' });
});

/** Requests an OTP to start the platform-admin forgot-password flow. Purpose is hardcoded here. */
export const requestPasswordResetOtp = asyncHandler(async (req: Request, res: Response) => {
    const { mobile } = parseOrThrow(platformAdminRequestOtpSchema, req.body);
    await requestOtp({ mobile, purpose: 'RESET_PASSWORD', actorType: 'PLATFORM_ADMIN' });
    sendSuccess(res, { message: 'If this mobile number is registered, an OTP has been sent' });
});

/** Verifies a LOGIN OTP and, on success, signs in exactly like POST /login. */
export const verifyOtpLogin = asyncHandler(async (req: Request, res: Response) => {
    const { mobile, otp } = parseOrThrow(platformAdminVerifyOtpLoginSchema, req.body);
    await verifyOtp({ mobile, otp, purpose: 'LOGIN', actorType: 'PLATFORM_ADMIN' });
    const { tokens, admin } = await loginPlatformAdminWithOtp(mobile);
    setPlatformAdminAuthCookies(res, tokens);
    sendSuccess(res, { admin });
});

/** Verifies a RESET_PASSWORD OTP and returns a short-lived resetToken for POST .../password/reset. */
export const verifyPasswordResetOtp = asyncHandler(async (req: Request, res: Response) => {
    const { mobile, otp } = parseOrThrow(platformAdminVerifyOtpResetSchema, req.body);
    await verifyOtp({ mobile, otp, purpose: 'RESET_PASSWORD', actorType: 'PLATFORM_ADMIN' });
    const resetToken = issueResetToken({ mobile, actorType: 'PLATFORM_ADMIN' });
    sendSuccess(res, { resetToken });
});

/** Completes the platform-admin forgot-password flow using the resetToken from verifyPasswordResetOtp. */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { mobile, resetToken, newPassword } = parseOrThrow(platformAdminResetPasswordSchema, req.body);
    await resetPlatformAdminPassword(mobile, resetToken, newPassword);
    sendSuccess(res, { passwordReset: true });
});
