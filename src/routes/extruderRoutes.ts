import { Router } from 'express';
import { approveExtruder, createExtruder, deleteExtruder, getExtruder, listExtruder, updateExtruder } from '../controllers/extruderController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

/**
 * @openapi
 * /api/v1/production/extruder:
 *   post:
 *     tags: [Extruder]
 *     summary: Create an Extruder production record
 *     description: >
 *       Creates a ProductionRecord (stage=EXTRUDER) with its ExtruderDetail,
 *       deducting the raw material, chemical and colour consumed from
 *       Inventory in the same transaction — no approval step, the record is
 *       immediately final. Requires the ADMIN, MANAGER, or SUPERVISOR role.
 *       Validates that colorId/sizeId/brandId/chemicalId all exist.
 *       If colorConsumedKg is omitted, it is auto-computed from the colour's
 *       configured standard (grams/25kg) scaled to rawMaterialKg. If a supplied
 *       colorConsumedKg deviates from that standard, the record is flagged
 *       isRecipeOverridden=true and overrideReason becomes mandatory.
 *       Optionally accepts yarnWasteKg/lumpsKg; each becomes a WastageRecord
 *       (codes YARN_WASTE/LUMPS) in the same transaction, but only when > 0 —
 *       omitting them or sending 0 creates no wastage record for that type.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExtruderCreateRequest'
 *     responses:
 *       201:
 *         description: Created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExtruderResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: colorId/sizeId/brandId/chemicalId does not exist (COLOR_NOT_FOUND, SIZE_NOT_FOUND, BRAND_NOT_FOUND, or CHEMICAL_NOT_FOUND).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Consuming this much raw material/chemical/colour would take Inventory below zero (INSUFFICIENT_STOCK).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Extruder]
 *     summary: List/filter Extruder production records
 *     description: Bounded, paginated list. Results are ordered by productionDate desc, then createdAt desc.
 *     parameters:
 *       - name: date_from
 *         in: query
 *         schema: { type: string, format: date }
 *         description: Inclusive lower bound on productionDate.
 *       - name: date_to
 *         in: query
 *         schema: { type: string, format: date }
 *         description: Inclusive upper bound on productionDate.
 *       - name: color_id
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: size
 *         in: query
 *         schema: { type: string, format: uuid }
 *         description: Size master-data id (PRD filter name is "size", not "size_id").
 *       - name: type
 *         in: query
 *         schema: { type: string, enum: [PRODUCTION, SAMPLE] }
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
 *               $ref: '#/components/schemas/ExtruderListResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), createExtruder);
router.get('/', listExtruder);

/**
 * @openapi
 * /api/v1/production/extruder/{id}:
 *   get:
 *     tags: [Extruder]
 *     summary: Get one Extruder production record
 *     parameters:
 *       - $ref: '#/components/parameters/ExtruderId'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExtruderResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     tags: [Extruder]
 *     summary: Edit an Extruder production record
 *     description: >
 *       No approval workflow — edits are always allowed. Partial update: only
 *       supplied fields change. If colorId, rawMaterialKg, or colorConsumedKg is
 *       touched, the recipe-override calculation is re-run against the (possibly
 *       new) colour's standard, and Inventory is re-adjusted by the difference
 *       between the old and new consumption (or fully reversed/re-applied if the
 *       brand/chemical/colour itself changed) in the same transaction.
 *       Requires the ADMIN, MANAGER, or SUPERVISOR role.
 *     parameters:
 *       - $ref: '#/components/parameters/ExtruderId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExtruderUpdateRequest'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExtruderResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: The new consumption would take Inventory below zero (INSUFFICIENT_STOCK).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     tags: [Extruder]
 *     summary: Delete an Extruder production record
 *     description: Deletes the record and any WastageRecords linked to it. Requires the ADMIN, MANAGER, or SUPERVISOR role.
 *     parameters:
 *       - $ref: '#/components/parameters/ExtruderId'
 *     responses:
 *       204:
 *         description: Deleted.
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getExtruder);
router.patch('/:id', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), updateExtruder);
router.delete('/:id', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), deleteExtruder);

/**
 * @openapi
 * /api/v1/production/extruder/{id}/approve:
 *   patch:
 *     tags: [Extruder]
 *     summary: Approve an Extruder production record
 *     description: >
 *       ADMIN-only — not exposed through the Right/RoleAccess system. Sets
 *       isApproved=true, approvedAt=now, approvedBy=<admin>. One-way; there
 *       is no un-approve endpoint.
 *     parameters:
 *       - $ref: '#/components/parameters/ExtruderId'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExtruderResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/approve', requireAuth('ADMIN'), approveExtruder);

export default router;
