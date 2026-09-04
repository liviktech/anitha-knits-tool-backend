import type pg from 'pg';
import { query, queryOne } from '../db/query.js';
import { withTransaction } from '../db/transaction.js';

/**
 * Color/Size/Chemical/Brand are structurally identical: id, company-scoped unique name, a
 * server-generated itemCode (prefix + zero-padded per-company sequence), createdAt/updatedAt.
 * One generic repository backs all four (and their sequence-counter helpers) instead of
 * four near-identical copies.
 */
export type LookupTable = 'brands' | 'chemicals' | 'colors' | 'sizes' | 'expense_names';

const SEQ_COLUMN: Record<LookupTable, string> = {
    brands: 'brand_seq',
    chemicals: 'chemical_seq',
    colors: 'color_seq',
    sizes: 'size_seq',
    expense_names: 'expense_name_seq',
};

const ITEM_CODE_PREFIX: Record<LookupTable, string> = {
    brands: 'BD',
    chemicals: 'CL',
    colors: 'CR',
    sizes: 'SE',
    expense_names: 'EN',
};

export interface LookupItemRow {
    id: string;
    itemCode: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}

const ITEM_COLUMNS_SQL = `id, item_code AS "itemCode", name, created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function listLookupItems(table: LookupTable, companyId: string): Promise<LookupItemRow[]> {
    const result = await query<LookupItemRow>(`SELECT ${ITEM_COLUMNS_SQL} FROM ${table} WHERE company_id = $1 ORDER BY name ASC`, [companyId]);
    return result.rows;
}

export async function findLookupItemName(table: LookupTable, id: string, companyId: string): Promise<string | null> {
    const row = await queryOne<{ name: string }>(`SELECT name FROM ${table} WHERE id = $1 AND company_id = $2`, [id, companyId]);
    return row?.name ?? null;
}

export async function existsLookupItem(table: LookupTable, id: string, companyId: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>(`SELECT EXISTS(SELECT 1 FROM ${table} WHERE id = $1 AND company_id = $2) AS exists`, [
        id,
        companyId,
    ]);
    return row?.exists ?? false;
}

/** Atomically assigns the next itemCode for `table`: prefix + a zero-padded per-company sequence. Mirrors userService.nextCustomUserId. */
async function nextLookupItemCode(client: pg.PoolClient, table: LookupTable, companyId: string): Promise<string> {
    const result = await client.query<{ seq: number }>(
        `UPDATE companies SET ${SEQ_COLUMN[table]} = ${SEQ_COLUMN[table]} + 1 WHERE id = $1 RETURNING ${SEQ_COLUMN[table]} AS seq`,
        [companyId],
    );
    const row = result.rows[0];
    if (!row) throw new Error(`Company ${companyId} not found while assigning ${table} itemCode`);
    return `${ITEM_CODE_PREFIX[table]}${String(row.seq - 1).padStart(3, '0')}`;
}

export async function createLookupItem(table: LookupTable, companyId: string, name: string, actor: string): Promise<LookupItemRow> {
    return withTransaction(async (client) => {
        const itemCode = await nextLookupItemCode(client, table, companyId);
        const result = await client.query<LookupItemRow>(
            `INSERT INTO ${table} (id, company_id, item_code, name, created_by, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, now())
             RETURNING ${ITEM_COLUMNS_SQL}`,
            [companyId, itemCode, name, actor],
        );
        const row = result.rows[0];
        if (!row) throw new Error(`Insert into ${table} returned no row`);
        return row;
    });
}

export async function updateLookupItem(table: LookupTable, id: string, name: string, actor: string): Promise<LookupItemRow> {
    const row = await queryOne<LookupItemRow>(
        `UPDATE ${table} SET name = $1, updated_by = $2, updated_at = now() WHERE id = $3 RETURNING ${ITEM_COLUMNS_SQL}`,
        [name, actor, id],
    );
    if (!row) throw new Error(`Update on ${table} returned no row for id ${id}`);
    return row;
}

export async function deleteLookupItem(table: LookupTable, id: string): Promise<void> {
    await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}
