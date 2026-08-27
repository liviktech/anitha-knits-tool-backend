import { Router } from 'express';
import {
    createCompany,
    getCompanyHandler,
    listCompaniesHandler,
    listCompanyUsersHandler,
    login,
    refresh,
    signup,
    updateCompanyHandler,
} from '../controllers/platformAdminController.js';
import { requirePlatformAdmin } from '../middlewares/platformAdminAuth.js';

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
router.post('/companies', requirePlatformAdmin, createCompany);

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
router.get('/companies', requirePlatformAdmin, listCompaniesHandler);

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
router.get('/companies/:id', requirePlatformAdmin, getCompanyHandler);
router.patch('/companies/:id', requirePlatformAdmin, updateCompanyHandler);

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

export default router;
