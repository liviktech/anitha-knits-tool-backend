import { Router } from 'express';
import { approveLooms, createLooms, deleteLooms, getAvailableYarn, getLooms, listLooms, updateLooms } from '../controllers/loomsController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

/**
 * @openapi
 * /api/v1/production/looms:
 *   post:
 *     tags: [Looms]
 *     summary: Create a Looms production record
 *     description: >
 *       Creates a ProductionRecord (stage=LOOMS) with its LoomDetail in one
 *       transaction. Validates that colorId/sizeId exist. No approval
 *       workflow — the record is immediately final. Optionally accepts
 *       loomsWasteKg; becomes a WastageRecord (code LOOMS_WASTE) in the same
 *       transaction, but only when > 0. Requires the ADMIN, MANAGER, or
 *       SUPERVISOR role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoomsCreateRequest'
 *     responses:
 *       201:
 *         description: Created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoomsResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: colorId or sizeId does not exist (COLOR_NOT_FOUND or SIZE_NOT_FOUND).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Looms]
 *     summary: List/filter Looms production records
 *     description: Bounded, paginated list. Results are ordered by productionDate desc, then createdAt desc.
 *     parameters:
 *       - name: date_from
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: date_to
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: color_id
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: size
 *         in: query
 *         schema: { type: string, format: uuid }
 *         description: Size master-data id.
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
 *               $ref: '#/components/schemas/LoomsListResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), createLooms);
router.get('/', listLooms);

/**
 * @openapi
 * /api/v1/production/looms/available:
 *   get:
 *     tags: [Looms]
 *     summary: Get the yarn available for Looms to consume for a colour+size variant
 *     description: >
 *       Cumulative, all-time Extruder yarnOutputKg for this colour+size minus
 *       all-time Looms yarnInputKg already recorded against it — the same
 *       figure the create/update guard enforces (YARN_INPUT_EXCEEDS_AVAILABLE).
 *     parameters:
 *       - name: colorId
 *         in: query
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: sizeId
 *         in: query
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: OK.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/available', getAvailableYarn);

/**
 * @openapi
 * /api/v1/production/looms/{id}:
 *   get:
 *     tags: [Looms]
 *     summary: Get one Looms production record
 *     parameters:
 *       - $ref: '#/components/parameters/LoomsId'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoomsResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     tags: [Looms]
 *     summary: Edit a Looms production record
 *     description: >
 *       No approval workflow — edits are always allowed. Partial update: only
 *       supplied fields change. Requires the ADMIN, MANAGER, or SUPERVISOR role.
 *     parameters:
 *       - $ref: '#/components/parameters/LoomsId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoomsUpdateRequest'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoomsResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     tags: [Looms]
 *     summary: Delete a Looms production record
 *     description: Deletes the record and any WastageRecords linked to it. Requires the ADMIN, MANAGER, or SUPERVISOR role.
 *     parameters:
 *       - $ref: '#/components/parameters/LoomsId'
 *     responses:
 *       204:
 *         description: Deleted.
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getLooms);
router.patch('/:id', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), updateLooms);
router.delete('/:id', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), deleteLooms);

/**
 * @openapi
 * /api/v1/production/looms/{id}/approve:
 *   patch:
 *     tags: [Looms]
 *     summary: Approve a Looms production record
 *     description: >
 *       ADMIN-only — not exposed through the Right/RoleAccess system. Sets
 *       isApproved=true, approvedAt=now, approvedBy=<admin>. One-way; there
 *       is no un-approve endpoint.
 *     parameters:
 *       - $ref: '#/components/parameters/LoomsId'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoomsResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/approve', requireAuth('ADMIN'), approveLooms);

export default router;
