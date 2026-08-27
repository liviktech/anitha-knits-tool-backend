import { Router } from 'express';
import {
  createColorConsumption,
  deleteColorConsumption,
  getLatestColorConsumption,
  listColorConsumption,
  updateColorConsumption,
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
 *       Creates a ColorConsumptionStandard. This is a single record covering
 *       every colour (white/blue/green), not one row per colour — the
 *       Extruder recipe lookup (PRD §5, §6) resolves kg-per-basis for a
 *       production record's colour by name against the latest active record
 *       as of that record's production date. Requires the ADMIN role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [whiteKgBasis, blueKgBasis, greenKgBasis]
 *             properties:
 *               date: { type: string, format: date, description: Effective date of this standard (used by the "latest as of" lookup). }
 *               basisWeightKg: { type: number, default: 25, description: How much HDPE one bag contains. }
 *               hdpematerialbag: { type: integer, default: 1, description: Number of HDPE bags per basis. }
 *               whiteKgBasis: { type: number, example: 0.15, description: Kilograms of colour per basis for White. }
 *               blueKgBasis: { type: number, example: 0.1, description: Kilograms of colour per basis for Blue. }
 *               greenKgBasis: { type: number, example: 0.2, description: Kilograms of colour per basis for Green. }
 *               chemicalWeight: { type: number, example: 1.2, description: Chemical weight in kg, common to all colours. }
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
 */
router.post('/', requireAuth('ADMIN'), createColorConsumption);

/**
 * @openapi
 * /api/v1/color-consumption-standard:
 *   get:
 *     tags: [Lookups]
 *     summary: Configuration history — every colour consumption standard ever recorded
 *     description: >
 *       Bounded, paginated list, most recent (by date, then createdAt) first. Backs a
 *       "Configuration History" table; use GET /latest for the single currently-active one.
 *     parameters:
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
 *               $ref: '#/components/schemas/ColorConsumptionStandardListResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get(
  '/',
  requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'),
  listColorConsumption,
);

/**
 * @openapi
 * /api/v1/color-consumption-standard/latest:
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

/**
 * @openapi
 * /api/v1/color-consumption-standard/{id}:
 *   patch:
 *     tags: [Lookups]
 *     summary: Edit a color consumption standard configuration
 *     description: Partial update — only supplied fields change. Requires the ADMIN role.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date: { type: string, format: date, description: Effective date of this standard (used by the "latest as of" lookup). }
 *               basisWeightKg: { type: number, description: How much HDPE one bag contains. }
 *               hdpematerialbag: { type: integer, description: Number of HDPE bags per basis. }
 *               whiteKgBasis: { type: number, example: 0.15, description: Kilograms of colour per basis for White. }
 *               blueKgBasis: { type: number, example: 0.1, description: Kilograms of colour per basis for Blue. }
 *               greenKgBasis: { type: number, example: 0.2, description: Kilograms of colour per basis for Green. }
 *               chemicalWeight: { type: number, example: 1.2, description: Chemical weight in kg, common to all colours. }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ColorConsumptionStandard'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: No standard exists with this id (COLOR_CONSUMPTION_STANDARD_NOT_FOUND).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     tags: [Lookups]
 *     summary: Delete a color consumption standard configuration
 *     description: Requires the ADMIN role.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted.
 *       404:
 *         description: No standard exists with this id (COLOR_CONSUMPTION_STANDARD_NOT_FOUND).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch('/:id', requireAuth('ADMIN'), updateColorConsumption);
router.delete('/:id', requireAuth('ADMIN'), deleteColorConsumption);

export default router;
