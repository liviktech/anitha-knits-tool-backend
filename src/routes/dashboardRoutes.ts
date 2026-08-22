import { Router } from 'express';
import { getProductionDashboardData } from '../controllers/dashboardController.js';

const router = Router();

/**
 * @openapi
 * /api/v1/dashboard/production:
 *   get:
 *     tags: [Dashboard]
 *     summary: Production KPIs for the "Daily Production & Wastage" dashboard
 *     description: >
 *       Per-stage totals (Extruder/Looms/Fabric Checking) for the summary
 *       cards, plus a day-wise breakdown for the details table — one call
 *       backs the whole screen. Defaults to the current UTC calendar month
 *       when date_from/date_to are omitted; the range is capped at 186 days
 *       to keep the underlying query bounded. Only days with at least one
 *       production record are included in `daily` (no zero-filled padding).
 *
 *       Wastage is summed from WastageRecord entries linked to each stage's
 *       production records, not derived from input−output (that would
 *       misrepresent Extruder, where chemical/colour mass is added during
 *       extrusion rather than lost). The Wastage API isn't built yet, so
 *       wastage/wastePct currently read 0 everywhere — that's correct given
 *       today's data, not a bug.
 *     parameters:
 *       - name: date_from
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: date_to
 *         in: query
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardProductionResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/production', getProductionDashboardData);

export default router;
