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
 *       Creates a ColorConsumptionStandard. This is a single record covering
 *       every colour (white/blue/green), not one row per colour — the
 *       Extruder recipe lookup (PRD §5, §6) resolves grams-per-basis for a
 *       production record's colour by name against the latest active record
 *       as of that record's production date. Requires the ADMIN role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [whiteGramsPerBasis, blueGramsPerBasis, greenGramsPerBasis]
 *             properties:
 *               date: { type: string, format: date, description: Effective date of this standard (used by the "latest as of" lookup). }
 *               basisWeightKg: { type: number, default: 25, description: How much HDPE one bag contains. }
 *               hdpematerialbag: { type: integer, default: 1, description: Number of HDPE bags per basis. }
 *               whiteGramsPerBasis: { type: number, description: Grams of colour per basis for White. }
 *               blueGramsPerBasis: { type: number, description: Grams of colour per basis for Blue. }
 *               greenGramsPerBasis: { type: number, description: Grams of colour per basis for Green. }
 *               chemicalWeight: { type: number, description: Chemical weight in kg, common to all colours. }
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
