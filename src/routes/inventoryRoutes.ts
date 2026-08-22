import { Router } from 'express';
import {
  createInventoryHandler,
  deleteInventoryHandler,
  getInventoryHandler,
  listInventoryHandler,
  updateInventoryHandler,
} from '../controllers/inventoryController.js';
import { requireAuth } from '../middlewares/auth.js';
import stockRoutes from './stockRoutes.js';

const router = Router();

// Mounted before the `/:id` routes below so `/inventory/stock` isn't swallowed by the `:id` param.
router.use(stockRoutes);

/**
 * @openapi
 * /api/v1/inventory:
 *   post:
 *     tags: [Inventory]
 *     summary: Manual stock intake
 *     description: >
 *       Adds `quantityKg` to the current balance for the given item (creating
 *       its Inventory row on first-ever intake) — it accumulates onto
 *       whatever is already on hand, it does not create a separate log entry.
 *       Requires the ADMIN, MANAGER, or SUPERVISOR role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InventoryCreateRequest'
 *     responses:
 *       201:
 *         description: Created or updated (the item's new balance).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: brandId/chemicalId/colorId does not exist.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Inventory]
 *     summary: Get current inventory balances (raw material/chemical/colour)
 *     description: >
 *       Bounded, paginated list — one row per item, each showing its current
 *       standing balance (updated in place, not a history of entries).
 *       Results are ordered by date desc, then createdAt desc.
 *     parameters:
 *       - name: date_from
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: date_to
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: type
 *         in: query
 *         schema: { type: string, enum: [RAW_MATERIAL, CHEMICAL, COLOR] }
 *       - name: name
 *         in: query
 *         schema: { type: string }
 *         description: Case-insensitive substring match.
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
 *               $ref: '#/components/schemas/InventoryListResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post(
  '/',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  createInventoryHandler,
);
router.get(
  '/',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  listInventoryHandler,
);

/**
 * @openapi
 * /api/v1/inventory/{id}:
 *   get:
 *     tags: [Inventory]
 *     summary: Get one inventory row
 *     parameters:
 *       - $ref: '#/components/parameters/InventoryId'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     tags: [Inventory]
 *     summary: Manually correct a balance
 *     description: >
 *       Only `weightKg`/`date` are adjustable — the item identity is fixed
 *       once a row exists. Use for reconciling against a physical stock
 *       count; not part of the normal intake/consumption flow.
 *       Requires the ADMIN, MANAGER, or SUPERVISOR role.
 *     parameters:
 *       - $ref: '#/components/parameters/InventoryId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InventoryUpdateRequest'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     tags: [Inventory]
 *     summary: Delete an inventory row
 *     description: Requires the ADMIN, MANAGER, or SUPERVISOR role.
 *     parameters:
 *       - $ref: '#/components/parameters/InventoryId'
 *     responses:
 *       204:
 *         description: Deleted.
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  '/:id',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  getInventoryHandler,
);
router.patch(
  '/:id',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  updateInventoryHandler,
);
router.delete(
  '/:id',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  deleteInventoryHandler,
);

export default router;
