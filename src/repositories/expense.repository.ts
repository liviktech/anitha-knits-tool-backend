import type pg from 'pg';
import { query, queryOne } from '../db/query.js';
import { withReadClient } from '../db/transaction.js';

export interface ExpenseRow {
    id: string;
    expenseId: string;
    date: Date;
    expenseName: string;
    amount: number;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

const EXPENSE_COLUMNS_SQL = `
    id, expense_id AS "expenseId", date, expense_name AS "expenseName", amount,
    created_at AS "createdAt", created_by AS "createdBy", updated_at AS "updatedAt", updated_by AS "updatedBy"
`;

/** All existing expense_id values for this company — scanned (not just the latest) so a deleted/out-of-order row never causes a number to be skipped or reused low. Must run on the caller's transaction client. */
export async function findExpenseIds(client: pg.PoolClient, companyId: string): Promise<string[]> {
    const result = await client.query<{ expenseId: string }>('SELECT expense_id AS "expenseId" FROM expenses WHERE company_id = $1', [companyId]);
    return result.rows.map((row) => row.expenseId);
}

export async function insertExpense(
    client: pg.PoolClient,
    input: { companyId: string; expenseId: string; date: Date; expenseName: string; amount: number; actor: string },
): Promise<ExpenseRow> {
    const result = await client.query<ExpenseRow>(
        `INSERT INTO expenses (id, company_id, expense_id, date, expense_name, amount, created_by, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())
         RETURNING ${EXPENSE_COLUMNS_SQL}`,
        [input.companyId, input.expenseId, input.date, input.expenseName, input.amount, input.actor],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into expenses returned no row');
    return row;
}

export interface ListExpensesFilter {
    dateFrom?: Date;
    dateTo?: Date;
    name?: string;
}

export async function listExpenses(
    companyId: string,
    filter: ListExpensesFilter,
    skip: number,
    take: number,
): Promise<{ rows: ExpenseRow[]; total: number }> {
    const conditions = ['company_id = $1'];
    const values: unknown[] = [companyId];
    if (filter.dateFrom) {
        values.push(filter.dateFrom);
        conditions.push(`date >= $${values.length}`);
    }
    if (filter.dateTo) {
        values.push(filter.dateTo);
        conditions.push(`date <= $${values.length}`);
    }
    if (filter.name) {
        values.push(`%${filter.name}%`);
        conditions.push(`expense_name ILIKE $${values.length}`);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<ExpenseRow>(
            `SELECT ${EXPENSE_COLUMNS_SQL} FROM expenses ${whereSql}
             ORDER BY date DESC, created_at DESC
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM expenses ${whereSql}`, values);
        return { rows: rowsResult.rows, total: Number(countResult.rows[0]?.count ?? 0) };
    });
}

export async function findExpenseById(id: string, companyId: string): Promise<ExpenseRow | null> {
    return queryOne<ExpenseRow>(`SELECT ${EXPENSE_COLUMNS_SQL} FROM expenses WHERE id = $1 AND company_id = $2`, [id, companyId]);
}

export async function existsExpenseInCompany(id: string, companyId: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM expenses WHERE id = $1 AND company_id = $2) AS exists', [
        id,
        companyId,
    ]);
    return row?.exists ?? false;
}

export interface UpdateExpensePatch {
    date?: Date;
    expenseName?: string;
    amount?: number;
}

export async function updateExpense(id: string, patch: UpdateExpensePatch, actor: string): Promise<ExpenseRow> {
    const columns: Record<keyof UpdateExpensePatch, string> = { date: 'date', expenseName: 'expense_name', amount: 'amount' };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(columns) as [keyof UpdateExpensePatch, string][]) {
        if (patch[key] === undefined) continue;
        values.push(patch[key]);
        sets.push(`${column} = $${values.length}`);
    }
    values.push(actor);
    sets.push(`updated_by = $${values.length}`);
    values.push(id);
    const row = await queryOne<ExpenseRow>(
        `UPDATE expenses SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING ${EXPENSE_COLUMNS_SQL}`,
        values,
    );
    if (!row) throw new Error(`Update on expenses returned no row for id ${id}`);
    return row;
}

export async function deleteExpense(id: string): Promise<void> {
    await query('DELETE FROM expenses WHERE id = $1', [id]);
}
