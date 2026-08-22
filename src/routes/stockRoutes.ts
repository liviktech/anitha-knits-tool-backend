import { Router } from 'express';
import { getInventoryStockHandler } from '../controllers/stockController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

/**
 * @openapi
 * /api/v1/inventory/stock:
 *   get:
 *     tags: [Inventory]
 *     summary: Stock on hand per brand/chemical/colour
 *     description: >
 *       For every raw-material brand, chemical, and colour on file for the
 *       company: current inventory balance (intake) minus what's been drawn
 *       down by extruder production. Covers every item in master data, not
 *       just ones with an inventory row on file — an item that's been
 *       consumed but never stocked still appears, with a negative balance.
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryStockSummaryResponse'
 */
router.get(
  '/stock',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  getInventoryStockHandler,
);

export default router;
