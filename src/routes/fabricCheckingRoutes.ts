import { Router } from 'express';
import {
  createFabricChecking,
  deleteFabricChecking,
  getFabricChecking,
  listFabricChecking,
  updateFabricChecking,
} from '../controllers/fabricCheckingController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

/**
 * @openapi
 * /api/v1/fabric-checking:
 *   post:
 *     tags: [Fabric Checking]
 *     summary: Create a Fabric Checking record
 *     description: >
 *       Creates a ProductionRecord (stage=FABRIC_CHECKING) with its
 *       FabricCheckDetail in one transaction. Validates that colorId/sizeId
 *       exist. No approval workflow — the record is immediately final.
 *       Optionally accepts fwKg/bwKg; each becomes a WastageRecord (codes
 *       FW/BW) in the same transaction, but only when > 0. BW is colour-
 *       tracked (PRD "B White"/"B Blue"), so its WastageRecord.colorId is set
 *       to this record's own colorId; FW's is not. GSM is a separate API (not
 *       yet implemented). Requires the ADMIN, MANAGER, or SUPERVISOR role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FabricCheckingCreateRequest'
 *     responses:
 *       201:
 *         description: Created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FabricCheckingResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: colorId or sizeId does not exist (COLOR_NOT_FOUND or SIZE_NOT_FOUND).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Fabric Checking]
 *     summary: List/filter Fabric Checking records
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
 *               $ref: '#/components/schemas/FabricCheckingListResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post(
  '/',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  createFabricChecking,
);
router.get('/', listFabricChecking);

/**
 * @openapi
 * /api/v1/fabric-checking/{id}:
 *   get:
 *     tags: [Fabric Checking]
 *     summary: Get one Fabric Checking record
 *     parameters:
 *       - $ref: '#/components/parameters/FabricCheckingId'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FabricCheckingResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     tags: [Fabric Checking]
 *     summary: Edit a Fabric Checking record
 *     description: >
 *       No approval workflow — edits are always allowed. Partial update: only
 *       supplied fields change. Requires the ADMIN, MANAGER, or SUPERVISOR role.
 *     parameters:
 *       - $ref: '#/components/parameters/FabricCheckingId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FabricCheckingUpdateRequest'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FabricCheckingResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     tags: [Fabric Checking]
 *     summary: Delete a Fabric Checking record
 *     description: Deletes the record and any WastageRecords linked to it. Requires the ADMIN, MANAGER, or SUPERVISOR role.
 *     parameters:
 *       - $ref: '#/components/parameters/FabricCheckingId'
 *     responses:
 *       204:
 *         description: Deleted.
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getFabricChecking);
router.patch(
  '/:id',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  updateFabricChecking,
);
router.delete(
  '/:id',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  deleteFabricChecking,
);

export default router;
