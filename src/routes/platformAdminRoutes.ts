import { Router } from 'express';
import {
    createCompany,
    getCompanyHandler,
    listCompaniesHandler,
    listCompanyUsersHandler,
    login,
    me,
    refresh,
    signup,
    updateCompanyHandler,
    logout,
    requestOtpLogin,
    requestPasswordResetOtp,
    verifyOtpLogin,
    verifyPasswordResetOtp,
    resetPassword,
} from '../controllers/platformAdminController.js';
import { listLivikEmployeesHandler } from '../controllers/livikEmployeeController.js';
import platformRoleAccessRoutes from './platformRoleAccessRoutes.js';
import platformModuleRoutes from './platformModuleRoutes.js';
import platformTabRoutes from './platformTabRoutes.js';
import platformRightRoutes from './platformRightRoutes.js';
import { requirePlatformAdmin } from '../middlewares/platformAdminAuth.js';
import { requirePlatformModuleAccess } from '../middlewares/requirePlatformModuleAccess.js';
import { otpRequestLimiter } from '../middlewares/rateLimit.js';

const router = Router();

/**
 * @openapi
 * /api/v1/platform/admin/signup:
 *   post:
 *     tags: [Platform Admin]
 *     summary: Platform-admin bootstrap signup (one-time)
 *     description: >
 *       Public, but only works once: rejects with 409 as soon as any
 *       PlatformAdmin row exists. There is no public, unbounded way to
 *       become a platform admin after the first one is created.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlatformAdminSignupRequest'
 *     responses:
 *       201:
 *         description: Created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlatformAdminSignupResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: A platform admin already exists (PLATFORM_ADMIN_ALREADY_EXISTS).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Public: one-time bootstrap (signupPlatformAdmin rejects once a PlatformAdmin already exists).
router.post('/signup', signup);

/**
 * @openapi
 * /api/v1/platform/admin/login:
 *   post:
 *     tags: [Platform Admin]
 *     summary: Platform-admin login
 *     description: >
 *       Authenticates by mobile + password against the PlatformAdmin table.
 *       Sets separate httpOnly platform-admin cookies (independent from
 *       company-user auth) — no tokens are returned in the response body.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: OK. Sets platform-admin httpOnly cookies.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlatformAdminLoginResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid mobile/password (INVALID_CREDENTIALS).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: This platform-admin account is inactive (ACCOUNT_INACTIVE).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', login);

/**
 * @openapi
 * /api/v1/platform/admin/refresh:
 *   post:
 *     tags: [Platform Admin]
 *     summary: Refresh a platform-admin session
 *     description: Exchanges the platform-admin refresh cookie for a fresh access+refresh pair, set as new httpOnly cookies.
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RefreshResponse'
 *       401:
 *         description: Missing, invalid, or expired refresh token (AUTH_REQUIRED / AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', refresh);

/**
 * @openapi
 * /api/v1/platform/admin/logout:
 *   post:
 *     tags: [Platform Admin]
 *     summary: Log out of the platform-admin session
 *     description: Clears the platform-admin access and refresh token cookies.
 *     responses:
 *       200:
 *         description: OK. Cookies cleared.
 */
router.post('/logout', logout);

/**
 * @openapi
 * /api/v1/platform/admin/me:
 *   get:
 *     tags: [Platform Admin]
 *     summary: Re-resolve the current LK Space session
 *     description: >
 *       Re-resolves the caller's own profile + access (PlatformRoleAccess -> module grants) from
 *       scratch — lets an already-logged-in Livik employee pick up a role change without
 *       re-authenticating, mirroring GET /company/auth/me.
 *     responses:
 *       200:
 *         description: OK.
 *       401:
 *         description: Missing, invalid, or expired platform-admin session (AUTH_REQUIRED / AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID).
 */
router.get('/me', requirePlatformAdmin, me);

/**
 * @openapi
 * /api/v1/platform/admin/companies:
 *   post:
 *     tags: [Platform Admin]
 *     summary: Create a company (customer signup)
 *     description: >
 *       Creates a Company and its first ADMIN User in one transaction. That
 *       admin's employeeDetails.customUserId is always companyCode + "001"
 *       (server-generated, not accepted in the request body) — subsequent
 *       users created for this company via POST /api/v1/company/user get
 *       companyCode + "002", "003", etc., auto-incremented per company.
 *       Platform-admin-only — not mounted publicly like the old
 *       /company/auth/signup.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupRequest'
 *     responses:
 *       201:
 *         description: Created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SignupResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Missing, invalid, or expired platform-admin session (AUTH_REQUIRED / AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: companyCode, adminMobile, or gst already in use (COMPANY_CODE_EXISTS, COMPANY_MOBILE_EXISTS, or COMPANY_GST_EXISTS).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/companies', requirePlatformAdmin, requirePlatformModuleAccess('companies'), createCompany);

/**
 * @openapi
 * /api/v1/platform/admin/companies:
 *   get:
 *     tags: [Platform Admin]
 *     summary: List companies (customers)
 *     description: Bounded, paginated list of every company. Results are ordered by createdAt desc.
 *     parameters:
 *       - name: isActive
 *         in: query
 *         schema: { type: boolean }
 *       - name: name
 *         in: query
 *         schema: { type: string }
 *         description: Case-insensitive substring match.
 *       - name: page
 *         in: query
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CompanyListResponse'
 *       401:
 *         description: Missing, invalid, or expired platform-admin session (AUTH_REQUIRED / AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/companies', requirePlatformAdmin, requirePlatformModuleAccess('companies'), listCompaniesHandler);

/**
 * @openapi
 * /api/v1/platform/admin/companies/{id}:
 *   get:
 *     tags: [Platform Admin]
 *     summary: Get one company
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CompanyResponse'
 *       401:
 *         description: Missing, invalid, or expired platform-admin session (AUTH_REQUIRED / AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     tags: [Platform Admin]
 *     summary: Edit a company's details
 *     description: >
 *       Partial update. Does not accept adminPasswordHash — resetting a
 *       company's admin password is a separate, dedicated concern.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompanyUpdateRequest'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CompanyResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Missing, invalid, or expired platform-admin session (AUTH_REQUIRED / AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: companyCode, adminMobile, or gst already in use (COMPANY_CODE_EXISTS, COMPANY_MOBILE_EXISTS, or COMPANY_GST_EXISTS).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/companies/:id', requirePlatformAdmin, requirePlatformModuleAccess('companies'), getCompanyHandler);
router.patch('/companies/:id', requirePlatformAdmin, requirePlatformModuleAccess('companies'), updateCompanyHandler);

/**
 * @openapi
 * /api/v1/platform/admin/companies/{id}/users:
 *   get:
 *     tags: [Platform Admin]
 *     summary: List a company's users
 *     description: >
 *       Bounded, paginated list of every user (all roles — ADMIN, MANAGER,
 *       SUPERVISOR, EMPLOYEE) belonging to one company. Results are ordered
 *       by createdAt desc. Unlike the tenant-side GET /api/v1/company/user
 *       (self-service, MANAGER/SUPERVISOR only), this is platform-admin
 *       oversight of an arbitrary company and returns the full roster.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Company id.
 *       - name: role
 *         in: query
 *         schema: { type: string, enum: [ADMIN, MANAGER, SUPERVISOR, EMPLOYEE] }
 *       - name: isActive
 *         in: query
 *         schema: { type: boolean }
 *       - name: page
 *         in: query
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlatformAdminUserListResponse'
 *       401:
 *         description: Missing, invalid, or expired platform-admin session (AUTH_REQUIRED / AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/companies/:id/users', requirePlatformAdmin, listCompanyUsersHandler);

/**
 * @openapi
 * /api/v1/platform/admin/livik-employees:
 *   get:
 *     tags: [Platform Admin]
 *     summary: List Livik's own employees (for platform role assignment)
 *     description: >
 *       Read-only, sourced from the Livik internal tool's own Employee table (a separate
 *       database — see config/livikDb.ts), not this app's company/User data. Used to populate
 *       the LK Space role-assignment UI.
 *     parameters:
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *       - name: page
 *         in: query
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: OK.
 *       401:
 *         description: Missing, invalid, or expired platform-admin session (AUTH_REQUIRED / AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID).
 */
router.get('/livik-employees', requirePlatformAdmin, listLivikEmployeesHandler);

// LK Space role management (create/get/update/delete/assign currently respond 501 — see
// platformRoleAccessService.ts TODO — but list + employee-access are real and used to render
// the Platform Roles tab, so this stays mounted rather than 404ing the whole sub-resource.
router.use('/role-access', requirePlatformAdmin, platformRoleAccessRoutes);

// Modules/tabs/rights CRUD currently respond 501 (platform_modules/platform_tabs/platform_rights
// tables don't exist yet — see platformModuleService.ts TODO). Mounted anyway so "Roles and
// Rights" gets a clear 501 explaining the gap instead of a bare 404.
router.use('/modules', requirePlatformAdmin, platformModuleRoutes);
router.use('/tabs', requirePlatformAdmin, platformTabRoutes);
router.use('/rights', requirePlatformAdmin, platformRightRoutes);

/**
 * @openapi
 * /api/v1/platform/admin/otp/request-login:
 *   post:
 *     tags: [Platform Admin]
 *     summary: Request an OTP for OTP-based platform-admin login
 *     description: >
 *       Sends a LOGIN-purpose SMS OTP via AWS Pinpoint if this mobile matches an active platform
 *       admin. Response is deliberately generic either way. Rate-limited (3 requests / 10 minutes
 *       per mobile number).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile]
 *             properties:
 *               mobile: { type: string }
 *     responses:
 *       200:
 *         description: OK. Generic response regardless of match.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Too many OTP requests (OTP_RATE_LIMITED).
 */
router.post('/otp/request-login', otpRequestLimiter, requestOtpLogin);

/**
 * @openapi
 * /api/v1/platform/admin/otp/login:
 *   post:
 *     tags: [Platform Admin]
 *     summary: Verify a LOGIN OTP and sign in
 *     description: Verifies the OTP requested via POST /otp/request-login, then signs in exactly like POST /login (sets the same httpOnly cookies).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile, otp]
 *             properties:
 *               mobile: { type: string }
 *               otp: { type: string }
 *     responses:
 *       200:
 *         description: OK. Sets platform-admin httpOnly cookies.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid/expired/exhausted OTP, or no matching admin (OTP_INVALID / OTP_EXPIRED / OTP_MAX_ATTEMPTS / INVALID_CREDENTIALS).
 *       403:
 *         description: This platform-admin account is inactive (ACCOUNT_INACTIVE).
 */
router.post('/otp/login', verifyOtpLogin);

/**
 * @openapi
 * /api/v1/platform/admin/password/otp/request:
 *   post:
 *     tags: [Platform Admin]
 *     summary: Request an OTP to start the platform-admin forgot-password flow
 *     description: >
 *       Sends a RESET_PASSWORD-purpose SMS OTP if this mobile matches an active platform admin.
 *       Response is deliberately generic either way. Rate-limited (3 requests / 10 minutes per
 *       mobile number).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile]
 *             properties:
 *               mobile: { type: string }
 *     responses:
 *       200:
 *         description: OK. Generic response regardless of match.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Too many OTP requests (OTP_RATE_LIMITED).
 */
router.post('/password/otp/request', otpRequestLimiter, requestPasswordResetOtp);

/**
 * @openapi
 * /api/v1/platform/admin/password/otp/verify:
 *   post:
 *     tags: [Platform Admin]
 *     summary: Verify a RESET_PASSWORD OTP
 *     description: Verifies the OTP requested via POST /password/otp/request and returns a short-lived resetToken (10 minutes) for POST /password/reset.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile, otp]
 *             properties:
 *               mobile: { type: string }
 *               otp: { type: string }
 *     responses:
 *       200:
 *         description: OK.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid/expired/exhausted OTP (OTP_INVALID / OTP_EXPIRED / OTP_MAX_ATTEMPTS).
 */
router.post('/password/otp/verify', verifyPasswordResetOtp);

/**
 * @openapi
 * /api/v1/platform/admin/password/reset:
 *   post:
 *     tags: [Platform Admin]
 *     summary: Complete the platform-admin forgot-password flow
 *     description: Consumes the resetToken from POST /password/otp/verify and sets a new password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile, resetToken, newPassword]
 *             properties:
 *               mobile: { type: string }
 *               resetToken: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: OK.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid or expired reset token (RESET_TOKEN_INVALID).
 *       403:
 *         description: This platform-admin account is inactive (ACCOUNT_INACTIVE).
 */
router.post('/password/reset', resetPassword);

export default router;
