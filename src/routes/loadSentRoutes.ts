import { Router } from 'express';
import {
    createLoadSentHandler,
    deleteLoadSentHandler,
    getLoadSentHandler,
    getStockBalanceHandler,
    listLoadSentHandler,
    updateLoadSentHandler,
} from '../controllers/loadSentController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

/**
 * @openapi
 * /api/v1/load-sent:
 *   post:
 *     tags: [Load Sent]
 *     summary: Create a Load Sent record
 *     description: Validates that colorId/sizeId exist.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoadSentCreateRequest'
 *     responses:
 *       201:
 *         description: Created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoadSentResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: colorId or sizeId does not exist (COLOR_NOT_FOUND or SIZE_NOT_FOUND).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Load Sent]
 *     summary: List/filter Load Sent records
 *     description: Bounded, paginated list. Results are ordered by date desc, then createdAt desc.
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
 *       - name: size_id
 *         in: query
 *         schema: { type: string, format: uuid }
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
 *               $ref: '#/components/schemas/LoadSentListResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), createLoadSentHandler);
/**
 * @openapi
 * /api/v1/load-sent/balance-stock:
 *   get:
 *     tags: [Load Sent]
 *     summary: Fetch color- and size-based stock balances
 *     description: Returns fabric checking output, wastages (FW & BW), load sent weights, and available stock balances grouped by color and size.
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       color: { $ref: '#/components/schemas/MasterDataRef' }
 *                       size: { $ref: '#/components/schemas/MasterDataRef' }
 *                       fabricCheckingOutputKg: { type: number, example: 500 }
 *                       loadSentFabricWeightKg: { type: number, example: 350 }
 *                       availableFabricStockKg: { type: number, example: 150 }
 *                       wastageFwGeneratedKg: { type: number, example: 20 }
 *                       loadSentFwWeightKg: { type: number, example: 15 }
 *                       availableFwStockKg: { type: number, example: 5 }
 *                       wastageBwGeneratedKg: { type: number, example: 30 }
 *                       loadSentBwWeightKg: { type: number, example: 10 }
 *                       availableBwStockKg: { type: number, example: 20 }
 */
router.get('/balance-stock', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), getStockBalanceHandler);
router.get('/', listLoadSentHandler);

/**
 * @openapi
 * /api/v1/load-sent/{id}:
 *   get:
 *     tags: [Load Sent]
 *     summary: Get one Load Sent record
 *     parameters:
 *       - $ref: '#/components/parameters/LoadSentId'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoadSentResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     tags: [Load Sent]
 *     summary: Update a Load Sent record
 *     parameters:
 *       - $ref: '#/components/parameters/LoadSentId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoadSentUpdateRequest'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoadSentResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     tags: [Load Sent]
 *     summary: Delete a Load Sent record
 *     parameters:
 *       - $ref: '#/components/parameters/LoadSentId'
 *     responses:
 *       204:
 *         description: Deleted.
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getLoadSentHandler);
router.patch('/:id', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), updateLoadSentHandler);
router.delete('/:id', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), deleteLoadSentHandler);

export default router;
