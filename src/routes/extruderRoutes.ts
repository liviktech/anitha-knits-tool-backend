import { Router } from 'express';
import {
    approveExtruder,
    createExtruder,
    getExtruder,
    listExtruder,
    rejectExtruder,
    updateExtruder,
} from '../controllers/extruderController.js';

const router = Router();

/**
 * @openapi
 * /api/v1/production/extruder:
 *   post:
 *     tags: [Extruder]
 *     summary: Create an Extruder production record
 *     description: >
 *       Creates a ProductionRecord (stage=EXTRUDER) with its ExtruderDetail in one
 *       transaction. Validates that colorId/sizeId/brandId/chemicalId all exist.
 *       If colorConsumedKg is omitted, it is auto-computed from the colour's
 *       configured standard (grams/25kg) scaled to rawMaterialKg. If a supplied
 *       colorConsumedKg deviates from that standard, the record is flagged
 *       isRecipeOverridden=true and overrideReason becomes mandatory.
 *       The record starts at status PENDING_APPROVAL (this module has no
 *       separate "submit" step — see the tag description).
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
 *               $ref: '#/components/schemas/ExtruderListResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/', createExtruder);
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
 *       Only allowed while status is PENDING_APPROVAL (EXTRUDER_NOT_EDITABLE
 *       otherwise — approved/rejected records are frozen). Partial update: only
 *       supplied fields change. If colorId, rawMaterialKg, or colorConsumedKg is
 *       touched, the recipe-override calculation is re-run against the (possibly
 *       new) colour's standard.
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
 *         description: Not PENDING_APPROVAL (EXTRUDER_NOT_EDITABLE), or the status changed concurrently between read and write.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', getExtruder);
router.patch('/:id', updateExtruder);

/**
 * @openapi
 * /api/v1/production/extruder/{id}/approve:
 *   post:
 *     tags: [Extruder]
 *     summary: Approve an Extruder production record
 *     description: >
 *       Conditional transition PENDING_APPROVAL → APPROVED, guarded against
 *       concurrent approve/reject races, with an audit ApprovalEvent written in
 *       the same transaction. NOTE — Kora ledger/inventory effects (PRD "approved
 *       Extruder output increases Kora Balance") are not yet applied here: the
 *       KoraBalance/KoraLedger/Inventory models do not exist in schema.prisma yet.
 *       No authorization/role check is enforced (this repo has no auth system
 *       yet) — the acting user is read from the x-user-email header if present.
 *     parameters:
 *       - $ref: '#/components/parameters/ExtruderId'
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApprovalActionRequest'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExtruderResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Not currently PENDING_APPROVAL (INVALID_STATUS_TRANSITION) — includes double-approve.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/:id/approve', approveExtruder);

/**
 * @openapi
 * /api/v1/production/extruder/{id}/reject:
 *   post:
 *     tags: [Extruder]
 *     summary: Reject an Extruder production record
 *     description: >
 *       Conditional transition PENDING_APPROVAL → REJECTED, with an audit
 *       ApprovalEvent written in the same transaction. Rejected records do not
 *       affect inventory/Kora and are frozen (no further edits).
 *     parameters:
 *       - $ref: '#/components/parameters/ExtruderId'
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApprovalActionRequest'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExtruderResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Not currently PENDING_APPROVAL (INVALID_STATUS_TRANSITION).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/:id/reject', rejectExtruder);

export default router;
