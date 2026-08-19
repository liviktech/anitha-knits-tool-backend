import { Router } from 'express';
import { getLiveness, getReadiness } from '../controllers/controller.js';

const router = Router();

/**
 * @openapi
 * /api/v1/health:
 *   get:
 *     tags: [Health]
 *     summary: Process liveness
 *     description: Returns 200 as long as the Node process is up. Does not check the database.
 *     responses:
 *       200:
 *         description: Process is up.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 uptimeSeconds: { type: number, example: 123.45 }
 */
router.get('/', getLiveness);

/**
 * @openapi
 * /api/v1/health/db:
 *   get:
 *     tags: [Health]
 *     summary: Process + database liveness
 *     description: Returns 200 only if the process is up AND a query against Postgres succeeds.
 *     responses:
 *       200:
 *         description: Process is up and the database is reachable.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 db:
 *                   type: object
 *                   properties:
 *                     connected: { type: boolean, example: true }
 *                     serverTime: { type: string, format: date-time }
 *       500:
 *         description: Database is unreachable.
 */
router.get('/db', getReadiness);

export default router;
