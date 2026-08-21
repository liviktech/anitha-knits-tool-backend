import { Router } from 'express';
import { login, signup } from '../controllers/authController.js';

const router = Router();

/**
 * @openapi
 * /api/v1/auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Company signup
 *     description: >
 *       Creates a Company and its first ADMIN User in one transaction. The
 *       admin's mobile/password are stored on both the Company (admin
 *       credential snapshot) and the new User row (used for login). This
 *       endpoint is public — no authentication is required.
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
 *       409:
 *         description: companyCode, adminMobile, or gst already in use (COMPANY_CODE_EXISTS, COMPANY_MOBILE_EXISTS, or COMPANY_GST_EXISTS).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/signup', signup);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with mobile + password
 *     description: >
 *       Authenticates a User by mobile + password. mobile is only unique per
 *       company (not globally), so every User row sharing that mobile number
 *       is checked; login succeeds only when exactly one account's password
 *       matches. On success, sets httpOnly access/refresh cookies (see
 *       requireAuth in middlewares/auth.ts) and updates lastLoginAt — no
 *       tokens are returned in the response body. This endpoint is public.
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

export default router;
