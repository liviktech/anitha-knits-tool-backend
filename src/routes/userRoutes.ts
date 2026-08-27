import { Router } from 'express';
import {
    createUserHandler,
    deleteUserHandler,
    getUserHandler,
    listAllUsersHandler,
    listUsersHandler,
    updateUserHandler,
} from '../controllers/userController.js';

const router = Router();

// requireAuth('ADMIN') is applied once at the mount point in routes/index.ts.

/**
 * @openapi
 * /api/v1/company/user:
 *   post:
 *     tags: [Company Users]
 *     summary: Create a managed user (MANAGER or SUPERVISOR)
 *     description: >
 *       Creates a User in the caller's own company. Only MANAGER/SUPERVISOR
 *       can be created here — no self-service ADMIN creation, and EMPLOYEE
 *       is out of scope for this endpoint. Every created user gets an
 *       employeeDetails.customUserId auto-assigned as companyCode +
 *       zero-padded sequence (e.g. "AK001002", continuing from "AK001001"
 *       assigned to the company's admin at company creation) — this is never
 *       accepted from the request body. Optionally accepts the rest of the
 *       employeeDetails object (designation/address/gender/salary/joiningDate)
 *       to record alongside the user — document fields on that profile
 *       (aadhaar) are read-only until an upload endpoint exists.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompanyUserCreateRequest'
 *     responses:
 *       201:
 *         description: Created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CompanyUserResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Missing, invalid, or expired access token (AUTH_REQUIRED / AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Authenticated, but not an ADMIN (INSUFFICIENT_ROLE).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: A user with this mobile number already exists in this company (USER_MOBILE_EXISTS).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Company Users]
 *     summary: List managed users (MANAGER/SUPERVISOR only)
 *     description: >
 *       Bounded, paginated list, scoped to the caller's own company. Only
 *       MANAGER/SUPERVISOR — for the full roster (all roles) see
 *       GET /api/v1/company/user/all.
 *     parameters:
 *       - name: role
 *         in: query
 *         schema: { type: string, enum: [MANAGER, SUPERVISOR] }
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
 *               $ref: '#/components/schemas/CompanyUserListResponse'
 *       401:
 *         description: Missing, invalid, or expired access token (AUTH_REQUIRED / AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Authenticated, but not an ADMIN (INSUFFICIENT_ROLE).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', createUserHandler);
router.get('/', listUsersHandler);

/**
 * @openapi
 * /api/v1/company/user/all:
 *   get:
 *     tags: [Company Users]
 *     summary: Full company user roster (all roles)
 *     description: >
 *       Bounded, paginated list of every user in the caller's own company —
 *       ADMIN, MANAGER, SUPERVISOR, and EMPLOYEE. Unlike GET /api/v1/company/user
 *       (this same router's root, which only manages MANAGER/SUPERVISOR),
 *       this is a read-only full-roster view. Results are ordered by createdAt desc.
 *     parameters:
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
 *         description: Missing, invalid, or expired access token (AUTH_REQUIRED / AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Authenticated, but not an ADMIN (INSUFFICIENT_ROLE).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/all', listAllUsersHandler); // must be registered before '/:id'

/**
 * @openapi
 * /api/v1/company/user/{id}:
 *   get:
 *     tags: [Company Users]
 *     summary: Get one managed user
 *     description: MANAGER/SUPERVISOR only — scoped to the caller's own company.
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
 *               $ref: '#/components/schemas/CompanyUserResponse'
 *       401:
 *         description: Missing, invalid, or expired access token (AUTH_REQUIRED / AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Authenticated, but not an ADMIN (INSUFFICIENT_ROLE).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     tags: [Company Users]
 *     summary: Edit a managed user
 *     description: >
 *       Partial update. Excludes mobile/password (separate concerns). Cannot
 *       be used to modify your own account (CANNOT_MODIFY_SELF). Supplying
 *       employeeDetails upserts that profile — only the fields provided on it
 *       change; an employeeDetails record is created on first update if the
 *       user doesn't have one yet.
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
 *             $ref: '#/components/schemas/CompanyUserUpdateRequest'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CompanyUserResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Missing, invalid, or expired access token (AUTH_REQUIRED / AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Authenticated, but not an ADMIN (INSUFFICIENT_ROLE).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Attempted to modify your own account through this endpoint (CANNOT_MODIFY_SELF).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     tags: [Company Users]
 *     summary: Deactivate a managed user
 *     description: >
 *       Soft-delete (sets isActive to false) — reversible via PATCH. Cannot
 *       be used on your own account (CANNOT_MODIFY_SELF).
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deactivated.
 *       401:
 *         description: Missing, invalid, or expired access token (AUTH_REQUIRED / AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Authenticated, but not an ADMIN (INSUFFICIENT_ROLE).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Attempted to modify your own account through this endpoint (CANNOT_MODIFY_SELF).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', getUserHandler);
router.patch('/:id', updateUserHandler);
router.delete('/:id', deleteUserHandler);

export default router;
