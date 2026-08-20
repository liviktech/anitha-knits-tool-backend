import { Router } from 'express';
import {
    createLoadSentHandler,
    deleteLoadSentHandler,
    getLoadSentHandler,
    listLoadSentHandler,
    updateLoadSentHandler,
} from '../controllers/loadSentController.js';

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
router.post('/', createLoadSentHandler);
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
router.patch('/:id', updateLoadSentHandler);
router.delete('/:id', deleteLoadSentHandler);

export default router;
