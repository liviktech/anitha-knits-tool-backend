import { Router } from 'express';
import {
  createExpenseHandler,
  deleteExpenseHandler,
  getExpenseHandler,
  listExpensesHandler,
  updateExpenseHandler,
} from '../controllers/expenseController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

/**
 * @openapi
 * /api/v1/expenses:
 *   post:
 *     tags: [Expenses]
 *     summary: Record a new expense
 *     description: >
 *       expenseId (e.g. "EXP-001") is generated server-side and must not be
 *       sent in the request body. Requires the ADMIN, MANAGER, or SUPERVISOR role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExpenseCreateRequest'
 *     responses:
 *       201:
 *         description: Created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExpenseResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *   get:
 *     tags: [Expenses]
 *     summary: List expenses
 *     description: >
 *       Bounded, paginated list ordered by date desc, then createdAt desc.
 *       Requires the ADMIN, MANAGER, or SUPERVISOR role.
 *     parameters:
 *       - name: date_from
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: date_to
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: name
 *         in: query
 *         schema: { type: string }
 *         description: Case-insensitive substring match against expenseName.
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
 *               $ref: '#/components/schemas/ExpenseListResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), createExpenseHandler);
router.get('/', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), listExpensesHandler);

/**
 * @openapi
 * /api/v1/expenses/{id}:
 *   get:
 *     tags: [Expenses]
 *     summary: Get one expense
 *     parameters:
 *       - $ref: '#/components/parameters/ExpenseId'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExpenseResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     tags: [Expenses]
 *     summary: Update an expense
 *     description: >
 *       Every field is optional, but at least one must be present. expenseId
 *       is immutable — not settable here. Requires the ADMIN, MANAGER, or
 *       SUPERVISOR role.
 *     parameters:
 *       - $ref: '#/components/parameters/ExpenseId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExpenseUpdateRequest'
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExpenseResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     tags: [Expenses]
 *     summary: Delete an expense
 *     description: Requires the ADMIN, MANAGER, or SUPERVISOR role.
 *     parameters:
 *       - $ref: '#/components/parameters/ExpenseId'
 *     responses:
 *       204:
 *         description: Deleted.
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), getExpenseHandler);
router.patch('/:id', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), updateExpenseHandler);
router.delete('/:id', requireAuth('ADMIN', 'MANAGER', 'SUPERVISOR'), deleteExpenseHandler);

export default router;
