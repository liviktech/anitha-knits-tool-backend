import { Router } from 'express';
import { getLookups } from '../controllers/lookup.js';

const router = Router();

/**
 * @openapi
 * /api/v1/lookups:
 *   get:
 *     tags: [Lookups]
 *     summary: Master data for dropdowns
 *     description: >
 *       Returns brands, colours, chemicals, and sizes in one call, each sorted
 *       by name. Used to populate the dropdowns on the production entry forms
 *       (Extruder, Looms, Fabric Checking).
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LookupsResponse'
 */
router.get('/', getLookups);

export default router;
