import { Router } from 'express';
import {
    createInventoryHandler,
    deleteInventoryHandler,
    getInventoryHandler,
    listInventoryHandler,
    updateInventoryHandler,
} from '../controllers/inventoryController.js';

const router = Router();


/**
 * @openapi
 * /api/v1/inventory:
 *   post:
 *     tags: [Inventory]
 *     summary: Create an inventory record
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InventoryCreateRequest'
 *     responses:
 *       201:
 *         description: Created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *   get:
 *     tags: [Inventory]
 *     summary: List/filter inventory records
 *     description: Bounded, paginated list. Results are ordered by date desc, then createdAt desc.
 *     parameters:
 *       - name: date_from
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: date_to
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: type
 *         in: query
 *         schema: { type: string, enum: [RAW_MATERIAL, CHEMICAL, YARN, FABRIC] }
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
router.post('/', createInventoryHandler);
router.get('/', listInventoryHandler);

/**
 * @openapi
 * /api/v1/inventory/{id}:
 *   get:
 *     tags: [Inventory]
 *     summary: Get one inventory record
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
 *     summary: Update an inventory record
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
 *     summary: Delete an inventory record
 *     parameters:
 *       - $ref: '#/components/parameters/InventoryId'
 *     responses:
 *       204:
 *         description: Deleted.
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getInventoryHandler);
router.patch('/:id', updateInventoryHandler);
router.delete('/:id', deleteInventoryHandler);

export default router;
