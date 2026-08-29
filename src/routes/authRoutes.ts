import { Router } from 'express';
import { login, me, refresh } from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

/**
 * @openapi
 * /api/v1/company/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Company-user login
 *     description: >
 *       Authenticates by mobile + password against the User table. mobile is
 *       only unique per company, so every same-mobile account is checked;
 *       login succeeds only if exactly one matches. Sets httpOnly
 *       access_token/refresh_token cookies — no tokens are returned in the
 *       response body. Public endpoint.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: OK. Sets access_token/refresh_token httpOnly cookies.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: No account matches this mobile + password (INVALID_CREDENTIALS).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: The matched account or its company is inactive (ACCOUNT_INACTIVE).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: This mobile + password matches more than one account across companies (AMBIGUOUS_LOGIN).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', login);

/**
 * @openapi
 * /api/v1/company/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh a company-user session
 *     description: Exchanges the refresh_token cookie for a fresh access+refresh pair, set as new httpOnly cookies.
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
 * /api/v1/company/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Re-resolve the current session's profile + access
 *     description: >
 *       Re-fetches the caller's profile and re-resolves their RoleAccess -> module/tab
 *       grants from scratch (not from the JWT, which never carries access). Use this to
 *       pick up a role/rights change made by an admin after the current session started,
 *       without requiring a fresh login.
 *     responses:
 *       200:
 *         description: OK.
 *       401:
 *         description: Missing or invalid session (AUTH_REQUIRED).
 */
router.get('/me', requireAuth(), me);

export default router;
