import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import { clearPlatformAdminAuthCookies, setPlatformAdminAuthCookies } from '../utils/platformAdminCookie.js';
import { getCurrentPlatformAdmin, loginPlatformAdmin, signupPlatformAdmin } from '../services/platformAdminService.js';
import { platformAdminLoginSchema, platformAdminSignupSchema } from '../validations/platformAdminValidation.js';
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
