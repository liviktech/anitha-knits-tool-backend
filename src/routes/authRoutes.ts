import { Router } from 'express';
import {
    login,
    me,
    refresh,
    logout,
    requestOtpLogin,
    requestPasswordResetOtp,
    verifyOtpLogin,
    verifyPasswordResetOtp,
    resetPassword,
} from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';
import { otpRequestLimiter } from '../middlewares/rateLimit.js';

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

/**
 * @openapi
 * /api/v1/company/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out of the current session
 *     description: Clears the access and refresh token cookies.
 *     responses:
 *       200:
 *         description: OK. Cookies cleared.
 */
router.post('/logout', logout);

/**
 * @openapi
 * /api/v1/company/auth/otp/request-login:
 *   post:
 *     tags: [Auth]
 *     summary: Request an OTP for OTP-based login
 *     description: >
 *       Sends a LOGIN-purpose SMS OTP via AWS Pinpoint if exactly one active account matches
 *       this mobile. Response is deliberately generic either way — never reveals whether the
 *       mobile number is registered. Rate-limited (3 requests / 10 minutes per mobile number).
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
 *       409:
 *         description: This mobile matches more than one active account across companies (AMBIGUOUS_LOGIN).
 *       429:
 *         description: Too many OTP requests (OTP_RATE_LIMITED).
 */
router.post('/otp/request-login', otpRequestLimiter, requestOtpLogin);

/**
 * @openapi
 * /api/v1/company/auth/otp/login:
 *   post:
 *     tags: [Auth]
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
 *         description: OK. Sets access_token/refresh_token httpOnly cookies.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid/expired/exhausted OTP, or no matching account (OTP_INVALID / OTP_EXPIRED / OTP_MAX_ATTEMPTS / INVALID_CREDENTIALS).
 *       403:
 *         description: The matched account or its company is inactive (ACCOUNT_INACTIVE).
 *       409:
 *         description: This mobile matches more than one account across companies (AMBIGUOUS_LOGIN).
 */
router.post('/otp/login', verifyOtpLogin);

/**
 * @openapi
 * /api/v1/company/auth/password/otp/request:
 *   post:
 *     tags: [Auth]
 *     summary: Request an OTP to start the forgot-password flow
 *     description: >
 *       Sends a RESET_PASSWORD-purpose SMS OTP if exactly one active account matches this
 *       mobile. Response is deliberately generic either way. Rate-limited (3 requests / 10
 *       minutes per mobile number).
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
 *       409:
 *         description: This mobile matches more than one active account across companies (AMBIGUOUS_LOGIN).
 *       429:
 *         description: Too many OTP requests (OTP_RATE_LIMITED).
 */
router.post('/password/otp/request', otpRequestLimiter, requestPasswordResetOtp);

/**
 * @openapi
 * /api/v1/company/auth/password/otp/verify:
 *   post:
 *     tags: [Auth]
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     resetToken: { type: string }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid/expired/exhausted OTP (OTP_INVALID / OTP_EXPIRED / OTP_MAX_ATTEMPTS).
 */
router.post('/password/otp/verify', verifyPasswordResetOtp);

/**
 * @openapi
 * /api/v1/company/auth/password/reset:
 *   post:
 *     tags: [Auth]
 *     summary: Complete the forgot-password flow
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
 *         description: The matched account or its company is inactive (ACCOUNT_INACTIVE).
 *       409:
 *         description: This mobile matches more than one account across companies (AMBIGUOUS_LOGIN).
 */
router.post('/password/reset', resetPassword);

export default router;
