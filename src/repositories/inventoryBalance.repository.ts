import type pg from 'pg';
import type { InventoryType } from '../types/enums.js';

export interface ItemRef {
    type: InventoryType;
    brandId?: string;
    chemicalId?: string;
    colorId?: string;
}

function itemWhereSql(input: ItemRef): { sql: string; param: string } {
    switch (input.type) {
        case 'HDPE':
            return { sql: 'brand_id', param: input.brandId! };
        case 'CHEMICAL':
            return { sql: 'chemical_id', param: input.chemicalId! };
        case 'COLOR':
            return { sql: 'color_id', param: input.colorId! };
    }
}

export function itemId(input: ItemRef): string {
    switch (input.type) {
        case 'HDPE':
            return input.brandId!;
        case 'CHEMICAL':
            return input.chemicalId!;
        case 'COLOR':
            return input.colorId!;
    }
}

/** Postgres transaction-scoped advisory lock, released automatically at commit/rollback — serializes concurrent balance adjustments to the same logical item. */
export async function acquireAdvisoryLock(client: pg.PoolClient, lockKey: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
}

export interface ExistingBalanceRow {
    id: string;
    weightKg: number;
    bagCount: number | null;
}

export async function findExistingBalance(client: pg.PoolClient, companyId: string, ref: ItemRef): Promise<ExistingBalanceRow | null> {
    const { sql: column, param } = itemWhereSql(ref);
    const result = await client.query<ExistingBalanceRow>(
        `SELECT id, weight_kg AS "weightKg", bag_count AS "bagCount" FROM inventory WHERE company_id = $1 AND type = $2 AND ${column} = $3`,
        [companyId, ref.type, param],
    );
    return result.rows[0] ?? null;
}

export async function updateBalanceRow(
    client: pg.PoolClient,
    id: string,
    input: { weightKg: number; bagCount?: number; actor: string; date?: Date },
): Promise<void> {
    const sets = ['weight_kg = $1', 'updated_by = $2', 'updated_at = now()'];
    const values: unknown[] = [input.weightKg, input.actor];
    if (input.bagCount !== undefined) {
        values.push(input.bagCount);
        sets.push(`bag_count = $${values.length}`);
    }
    if (input.date) {
        values.push(input.date);
        sets.push(`date = $${values.length}`);
    }
    values.push(id);
    await client.query(`UPDATE inventory SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
}

export async function insertBalanceRow(
    client: pg.PoolClient,
    input: { companyId: string; ref: ItemRef; name: string; weightKg: number; bagCount?: number; DC: string; actor: string; date?: Date },
): Promise<{ id: string }> {
    const result = await client.query<{ id: string }>(
        `INSERT INTO inventory (id, company_id, type, name, weight_kg, bag_count, "DC_NUMBER", created_by, date, brand_id, chemical_id, color_id, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, COALESCE($8, now()), $9, $10, $11, now())
         RETURNING id`,
        [
            input.companyId,
            input.ref.type,
            input.name,
            input.weightKg,
            input.bagCount ?? null,
            input.DC,
            input.actor,
            input.date ?? null,
            input.ref.brandId ?? null,
            input.ref.chemicalId ?? null,
            input.ref.colorId ?? null,
        ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into inventory returned no row');
    return row;
}
