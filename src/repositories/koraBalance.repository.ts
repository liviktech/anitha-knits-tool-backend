import type pg from 'pg';
import { query, queryOne } from '../db/query.js';
import type { KoraEntryType } from '../types/enums.js';

export interface KoraBalanceRow {
    id: string;
    balanceKg: number;
}

/**
 * Atomically credits/debits the running balance for (colorId, sizeId) — a single INSERT ... ON
 * CONFLICT DO UPDATE statement, never a read-then-write, so concurrent Fabric Checking creations
 * against the same variant serialize correctly at the row-lock level and `balanceAfterKg` always
 * reflects the true post-write balance. Must run on the caller's transaction client.
 */
export async function upsertKoraBalanceIncrement(
    client: pg.PoolClient,
    input: { companyId: string; colorId: string; sizeId: string; deltaKg: number },
): Promise<KoraBalanceRow> {
    const result = await client.query<KoraBalanceRow>(
        `INSERT INTO kora_balances (id, company_id, color_id, size_id, balance_kg, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, now())
         ON CONFLICT (color_id, size_id)
         DO UPDATE SET balance_kg = kora_balances.balance_kg + EXCLUDED.balance_kg, updated_at = now()
         RETURNING id, balance_kg AS "balanceKg"`,
        [input.companyId, input.colorId, input.sizeId, input.deltaKg],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Upsert into kora_balances returned no row');
    return row;
}

export async function insertKoraLedgerEntry(
    client: pg.PoolClient,
    input: {
        koraBalanceId: string;
        entryType: KoraEntryType;
        stockDate: Date;
        productionRecordId: string;
        quantityKg: number;
        balanceAfterKg: number;
        actor: string;
    },
): Promise<void> {
    await client.query(
        `INSERT INTO kora_ledger_entries (id, kora_balance_id, entry_type, stock_date, production_record_id, quantity_kg, balance_after_kg, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
        [input.koraBalanceId, input.entryType, input.stockDate, input.productionRecordId, input.quantityKg, input.balanceAfterKg, input.actor],
    );
}

export interface KoraLedgerEntryForReversalRow {
    id: string;
    koraBalanceId: string;
    entryType: KoraEntryType;
    quantityKg: number;
}

export async function findKoraLedgerEntryByProductionRecord(
    client: pg.PoolClient,
    productionRecordId: string,
): Promise<KoraLedgerEntryForReversalRow | null> {
    const result = await client.query<KoraLedgerEntryForReversalRow>(
        'SELECT id, kora_balance_id AS "koraBalanceId", entry_type AS "entryType", quantity_kg AS "quantityKg" FROM kora_ledger_entries WHERE production_record_id = $1',
        [productionRecordId],
    );
    return result.rows[0] ?? null;
}

export async function incrementKoraBalance(client: pg.PoolClient, koraBalanceId: string, deltaKg: number): Promise<void> {
    await client.query('UPDATE kora_balances SET balance_kg = balance_kg + $1, updated_at = now() WHERE id = $2', [deltaKg, koraBalanceId]);
}

export async function deleteKoraLedgerEntry(client: pg.PoolClient, id: string): Promise<void> {
    await client.query('DELETE FROM kora_ledger_entries WHERE id = $1', [id]);
}

export interface KoraBalanceListRow {
    id: string;
    color: { id: string; name: string };
    size: { id: string; name: string };
    balanceKg: number;
    updatedAt: Date;
}

export async function listKoraBalances(companyId: string): Promise<KoraBalanceListRow[]> {
    const result = await query<{
        id: string;
        colorId: string;
        colorName: string;
        sizeId: string;
        sizeName: string;
        balanceKg: number;
        updatedAt: Date;
    }>(
        `SELECT kb.id, c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName",
                kb.balance_kg AS "balanceKg", kb.updated_at AS "updatedAt"
         FROM kora_balances kb
         JOIN colors c ON c.id = kb.color_id
         JOIN sizes s ON s.id = kb.size_id
         WHERE kb.company_id = $1
         ORDER BY c.name ASC, s.name ASC`,
        [companyId],
    );
    return result.rows.map((row) => ({
        id: row.id,
        color: { id: row.colorId, name: row.colorName },
        size: { id: row.sizeId, name: row.sizeName },
        balanceKg: row.balanceKg,
        updatedAt: row.updatedAt,
    }));
}

export async function findKoraBalanceByVariant(companyId: string, colorId: string, sizeId: string): Promise<KoraBalanceRow | null> {
    return queryOne<KoraBalanceRow>('SELECT id, balance_kg AS "balanceKg" FROM kora_balances WHERE company_id = $1 AND color_id = $2 AND size_id = $3', [
        companyId,
        colorId,
        sizeId,
    ]);
}

export interface KoraLedgerRow {
    id: string;
    entryType: KoraEntryType;
    stockDate: Date;
    quantityKg: number;
    balanceAfterKg: number;
    productionRecordId: string | null;
    createdAt: Date;
    createdBy: string;
}

export async function listKoraLedgerEntries(
    koraBalanceId: string,
    filter: { dateFrom?: Date; dateTo?: Date },
    skip: number,
    take: number,
): Promise<{ rows: KoraLedgerRow[]; total: number }> {
    const conditions = ['kora_balance_id = $1'];
    const values: unknown[] = [koraBalanceId];
    if (filter.dateFrom) {
        values.push(filter.dateFrom);
        conditions.push(`stock_date >= $${values.length}`);
    }
    if (filter.dateTo) {
        values.push(filter.dateTo);
        conditions.push(`stock_date <= $${values.length}`);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    const rowsResult = await query<KoraLedgerRow>(
        `SELECT id, entry_type AS "entryType", stock_date AS "stockDate", quantity_kg AS "quantityKg",
                balance_after_kg AS "balanceAfterKg", production_record_id AS "productionRecordId",
                created_at AS "createdAt", created_by AS "createdBy"
         FROM kora_ledger_entries ${whereSql}
         ORDER BY stock_date DESC, created_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, take, skip],
    );
    const countResult = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM kora_ledger_entries ${whereSql}`, values);
    return { rows: rowsResult.rows, total: Number(countResult.rows[0]?.count ?? 0) };
}
