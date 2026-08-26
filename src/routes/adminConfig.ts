import { Router } from 'express';
import {
  createColorConsumption,
  getLatestColorConsumption,
} from '../controllers/adminConfig.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

/**
 * @openapi
 * /api/v1/color-consumption-standard:
 *   post:
 *     tags: [Lookups]
 *     summary: Create a color consumption standard configuration
 *     description: >
 *       Creates a ColorConsumptionStandard for a colour. Requires the ADMIN role.
 *       Fails with 409 (COLOR_CONSUMPTION_STANDARD_EXISTS) if a standard already
 *       exists for the colour (colorId is unique).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [colorId, gramsPerBasis]
 *             properties:
 *               colorId: { type: string, format: uuid }
 *               gramsPerBasis: { type: number }
 *               basisWeightKg: { type: number, default: 25 }
 *               hdpematerialbag: { type: integer, default: 1 }
 *               chemicalWeight: { type: number }
 *               date: { type: string, format: date }
 *               isActive: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ColorConsumptionStandard'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: colorId does not exist (COLOR_NOT_FOUND).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: A consumption standard already exists for this colour (COLOR_CONSUMPTION_STANDARD_EXISTS).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', requireAuth('ADMIN'), createColorConsumption);

/**
 * @openapi
 * /api/v1/lookups/color-consumption-standard/latest:
 *   get:
 *     tags: [Lookups]
 *     summary: Get latest color consumption configuration as of a date
 *     parameters:
 *       - name: date
 *         in: query
 *         schema: { type: string, format: date }
 *         description: Inclusive date to fetch latest configuration (defaults to today)
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ColorConsumptionStandard'
 */
router.get(
  '/latest',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  getLatestColorConsumption,
);

export default router;
