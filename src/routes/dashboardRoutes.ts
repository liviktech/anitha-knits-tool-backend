import { Router } from 'express';
import { getMonthlyDashboardData, getProductionDashboardData } from '../controllers/dashboardController.js';
import { requireModuleAccess } from '../middlewares/requireModuleAccess.js';

const router = Router();

/**
 * @openapi
 * /api/v1/dashboard:
 *   get:
 *     tags: [Dashboard]
 *     summary: Monthly management dashboard
 *     description: >
 *       One call backing the monthly dashboard: inventory on hand
 *       (HDPE/chemical/colour), stock delivered (Load Sent), fabric
 *       production (Fabric Checking output, colour+size variant-wise plus an
 *       overall total), overall production totals for the month across all
 *       three stages (Extruder/Looms/Fabric Checking — same shape as
 *       GET /api/v1/dashboard/production's summary cards, but for the whole
 *       calendar month rather than an arbitrary range), and wastage across
 *       all 5 client-terminology categories (Yarn Waste, LUMS/LUMPS, Looms
 *       Waste, FW, BW) — all scoped to one calendar month. Defaults to the
 *       current UTC calendar month when month/year are omitted.
 *     parameters:
 *       - name: month
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *         description: 1-12. Defaults to the current UTC month.
 *       - name: year
 *         in: query
 *         schema: { type: integer, minimum: 2000, maximum: 2100 }
 *         description: Defaults to the current UTC year.
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardMonthlyResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/', requireModuleAccess('dashboard'), getMonthlyDashboardData);

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
// Backs both the Dashboard page's summary cards AND the Production module's Day Wise
// Report (day-wise-queries.ts) — accessible with either module's grant, not just 'dashboard'.
router.get('/production', requireModuleAccess(['dashboard', 'productiondetails']), getProductionDashboardData);

export default router;
