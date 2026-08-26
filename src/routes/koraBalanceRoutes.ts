import { Router } from 'express';
import { listBalances, getLedger } from '../controllers/koraBalanceController.js';

const router = Router();

/**
 * @openapi
 * /api/v1/kora-balance:
 *   get:
 *     tags: [Kora Balance]
 *     summary: List all kora balances
 *     description: >
 *       Returns the current kora balance per color+size variant.
 *       Each row shows how much fabric stock (fabric_output_kg − fabric_input_kg)
 *       remains for that variant.
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KoraBalanceListResponse'
 */
router.get('/', listBalances);

/**
 * @openapi
 * /api/v1/kora-balance/{colorId}/{sizeId}/ledger:
 *   get:
 *     tags: [Kora Balance]
 *     summary: Get kora ledger for a color+size variant
 *     description: >
 *       Returns the paginated ledger of all CREDIT (looms output) and DEBIT
 *       (fabric checking input) entries for a specific color+size variant,
 *       ordered by date descending. Each entry shows quantity, running balance,
 *       and the linked production record.
 *     parameters:
 *       - name: colorId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: sizeId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: date_from
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: date_to
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: page
 *         in: query
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: >
 *           OK. meta.balance echoes the variant's current balance even when
 *           no KoraBalance row exists yet (balanceKg 0, empty data array).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KoraLedgerListResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/:colorId/:sizeId/ledger', getLedger);

export default router;
