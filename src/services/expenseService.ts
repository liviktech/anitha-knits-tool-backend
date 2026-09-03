import type pg from 'pg';
import { withTransaction } from '../db/transaction.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import {
    deleteExpense as deleteExpenseRepo,
    existsExpenseInCompany,
    findExpenseById,
    findExpenseIds,
    insertExpense,
    listExpenses as listExpensesRepo,
    updateExpense as updateExpenseRepo,
} from '../repositories/expense.repository.js';
import type { CreateExpenseInput, UpdateExpenseInput, ListExpenseQuery } from '../validations/expenseValidation.js';

const EXPENSE_ID_PATTERN = /^EXP-(\d+)$/;

/**
 * Next sequential id for this company, e.g. EXP-001, EXP-002. Scans all
 * existing ids (not just the latest by date/createdAt) so a deleted or
 * out-of-order row never causes a number to be skipped or reused low.
 * Runs inside the caller's transaction to keep the read-then-insert as tight
 * as this app's low-concurrency usage warrants.
 */
async function generateExpenseId(companyId: string, client: pg.PoolClient): Promise<string> {
    const ids = await findExpenseIds(client, companyId);

    let max = 0;
    for (const expenseId of ids) {
        const match = EXPENSE_ID_PATTERN.exec(expenseId);
        if (match) max = Math.max(max, parseInt(match[1]!, 10));
    }

    return `EXP-${String(max + 1).padStart(3, '0')}`;
}

export async function createExpense(input: CreateExpenseInput, companyId: string, actor: string) {
    return withTransaction(async (client) => {
        const expenseId = await generateExpenseId(companyId, client);
        return insertExpense(client, {
            companyId,
            expenseId,
            date: input.date ?? new Date(),
            expenseName: input.expenseName,
            amount: input.amount,
            actor,
        });
    });
}

export async function listExpenses(query: ListExpenseQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await listExpensesRepo(companyId, { dateFrom: query.date_from, dateTo: query.date_to, name: query.name }, skip, take);
    return { items: rows, meta: toPageMeta(query, total) };
}

export async function getExpenseById(id: string, companyId: string) {
    const record = await findExpenseById(id, companyId);
    if (!record) throw new NotFoundError('Expense not found', 'EXPENSE_NOT_FOUND', { id });
    return record;
}

export async function updateExpense(id: string, input: UpdateExpenseInput, companyId: string, actor: string) {
    const existing = await existsExpenseInCompany(id, companyId);
    if (!existing) throw new NotFoundError('Expense not found', 'EXPENSE_NOT_FOUND', { id });

    return updateExpenseRepo(id, { date: input.date, expenseName: input.expenseName, amount: input.amount }, actor);
}

export async function deleteExpense(id: string, companyId: string) {
    const existing = await existsExpenseInCompany(id, companyId);
    if (!existing) throw new NotFoundError('Expense not found', 'EXPENSE_NOT_FOUND', { id });

    await deleteExpenseRepo(id);
}
