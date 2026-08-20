import { Router } from 'express';
import { createLooms, getLooms, listLooms } from '../controllers/loomsController.js';

const router = Router();

/**
 * @openapi
 * /api/v1/production/looms:
 *   post:
 *     tags: [Looms]
 *     summary: Create a Looms production record
 *     description: >
 *       Creates a ProductionRecord (stage=LOOMS) with its LoomDetail in one
 *       transaction. Validates that colorId/sizeId exist. Starts at status
 *       PENDING_APPROVAL (this module has no separate "submit" step).
 *       Edit/approve/reject are not implemented yet — only create/list/get.
 *       Optionally accepts loomsWasteKg; becomes a WastageRecord (code
 *       LOOMS_WASTE) in the same transaction, but only when > 0.
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
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [DRAFT, SUBMITTED, PENDING_APPROVAL, APPROVED, REJECTED] }
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
router.post('/', createLooms);
router.get('/', listLooms);

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
 */
router.get('/:id', getLooms);

export default router;
