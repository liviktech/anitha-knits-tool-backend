import { Router } from 'express';
import { signup } from '../controllers/authController.js';

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
 *       endpoint is public — no authentication is required. Login is a
 *       separate endpoint (not yet implemented).
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

export default router;
