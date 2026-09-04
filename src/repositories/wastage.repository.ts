import type pg from 'pg';
import { query, queryOne, type Queryable } from '../db/query.js';
import type { ProductionStage } from '../types/enums.js';

export interface WastageRow {
    id: string;
    quantityKg: number;
    wastageType: { id: string; code: string; name: string };
    color: { id: string; name: string } | null;
}

interface WastageQueryRow {
    id: string;
    quantityKg: number;
    productionRecordId: string;
    wastageTypeId: string;
    wastageTypeCode: string;
    wastageTypeName: string;
    colorId: string | null;
    colorName: string | null;
}

const WASTAGE_SELECT_SQL = `
    SELECT wr.id, wr.quantity_kg AS "quantityKg", wr.production_record_id AS "productionRecordId",
           wt.id AS "wastageTypeId", wt.code AS "wastageTypeCode", wt.name AS "wastageTypeName",
           c.id AS "colorId", c.name AS "colorName"
    FROM wastage_records wr
    JOIN wastage_types wt ON wt.id = wr.wastage_type_id
    LEFT JOIN colors c ON c.id = wr.color_id
`;

function toWastageRow(row: WastageQueryRow): WastageRow {
    return {
        id: row.id,
        quantityKg: row.quantityKg,
        wastageType: { id: row.wastageTypeId, code: row.wastageTypeCode, name: row.wastageTypeName },
        color: row.colorId ? { id: row.colorId, name: row.colorName! } : null,
    };
}

/**
 * Wastage rows for one production record, in the shape extruder/looms/fabricChecking selects
 * expose. Pass the transaction's `client` as `executor` when called mid-transaction (e.g.
 * re-fetching a record right after writing it) — otherwise a plain `pool` read wouldn't see the
 * transaction's own uncommitted writes.
 */
export async function findWastagesByProductionRecordId(productionRecordId: string, executor?: Queryable): Promise<WastageRow[]> {
    const result = await query<WastageQueryRow>(`${WASTAGE_SELECT_SQL} WHERE wr.production_record_id = $1`, [productionRecordId], executor);
    return result.rows.map(toWastageRow);
}

/** Batched wastage lookup for a paginated list of production records — avoids N+1 queries. */
export async function findWastagesByProductionRecordIds(productionRecordIds: string[]): Promise<Map<string, WastageRow[]>> {
    const map = new Map<string, WastageRow[]>();
    if (productionRecordIds.length === 0) return map;
    const result = await query<WastageQueryRow>(`${WASTAGE_SELECT_SQL} WHERE wr.production_record_id = ANY($1::uuid[])`, [productionRecordIds]);
    for (const row of result.rows) {
        const mapped = toWastageRow(row);
        const list = map.get(row.productionRecordId);
        if (list) list.push(mapped);
        else map.set(row.productionRecordId, [mapped]);
    }
    return map;
}

export interface WastageTypeRow {
    id: string;
    isActive: boolean;
}

export async function findWastageType(
    executor: pg.PoolClient | undefined,
    companyId: string,
    stage: ProductionStage,
    code: string,
): Promise<WastageTypeRow | null> {
    const executorOrPool = executor ?? undefined;
    return queryOne<WastageTypeRow>(
        'SELECT id, is_active AS "isActive" FROM wastage_types WHERE company_id = $1 AND stage = $2 AND code = $3',
        [companyId, stage, code],
        executorOrPool,
    );
}

export interface WastageCreateInput {
    companyId: string;
    wastageTypeId: string;
    colorId?: string | null;
    quantityKg: number;
    actor: string;
}

/** Inserts one wastage_records row tied to `productionRecordId` — used inside a caller-managed transaction (create flows). */
export async function insertWastageRecord(client: pg.PoolClient, productionRecordId: string, input: WastageCreateInput): Promise<void> {
    await client.query(
        `INSERT INTO wastage_records (id, company_id, production_record_id, wastage_type_id, color_id, quantity_kg, created_by, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())`,
        [input.companyId, productionRecordId, input.wastageTypeId, input.colorId ?? null, input.quantityKg, input.actor],
    );
}

export async function findWastageRecordByTypeForProduction(
    client: pg.PoolClient,
    productionRecordId: string,
    wastageTypeId: string,
): Promise<{ id: string } | null> {
    const result = await client.query<{ id: string }>('SELECT id FROM wastage_records WHERE production_record_id = $1 AND wastage_type_id = $2', [
        productionRecordId,
        wastageTypeId,
    ]);
    return result.rows[0] ?? null;
}

export async function updateWastageRecord(
    client: pg.PoolClient,
    id: string,
    input: { quantityKg: number; colorId?: string | null; actor: string },
): Promise<void> {
    await client.query('UPDATE wastage_records SET quantity_kg = $1, color_id = $2, updated_by = $3, updated_at = now() WHERE id = $4', [
        input.quantityKg,
        input.colorId ?? null,
        input.actor,
        id,
    ]);
}

export async function deleteWastageRecordById(client: pg.PoolClient, id: string): Promise<void> {
    await client.query('DELETE FROM wastage_records WHERE id = $1', [id]);
}

export async function deleteWastageRecordsForProduction(client: pg.PoolClient, productionRecordId: string): Promise<void> {
    await client.query('DELETE FROM wastage_records WHERE production_record_id = $1', [productionRecordId]);
}

export interface WastageTypeSummaryRow {
    code: string;
    name: string;
    stage: ProductionStage;
}

export async function findWastageTypesByCodes(companyId: string, codes: string[]): Promise<WastageTypeSummaryRow[]> {
    const result = await query<WastageTypeSummaryRow>('SELECT code, name, stage FROM wastage_types WHERE company_id = $1 AND code = ANY($2::text[])', [
        companyId,
        codes,
    ]);
    return result.rows;
}

export interface WastageRecordForSummaryRow {
    quantityKg: number;
    code: string;
    /** The linked production record's own colour/size (not wastage_records.color_id, which is only ever set for BW and always mirrors this anyway) — lets callers break wastage down by variant. */
    colorId: string | null;
    colorName: string | null;
    sizeId: string | null;
    sizeName: string | null;
}

export async function findWastageRecordsForDateRange(companyId: string, dateFrom: Date, dateTo: Date): Promise<WastageRecordForSummaryRow[]> {
    const result = await query<WastageRecordForSummaryRow>(
        `SELECT wr.quantity_kg AS "quantityKg", wt.code,
                pc.id AS "colorId", pc.name AS "colorName",
                ps.id AS "sizeId", ps.name AS "sizeName"
         FROM wastage_records wr
         JOIN wastage_types wt ON wt.id = wr.wastage_type_id
         JOIN production_records pr ON pr.id = wr.production_record_id
         LEFT JOIN colors pc ON pc.id = pr.color_id
         LEFT JOIN sizes ps ON ps.id = pr.size_id
         WHERE wr.company_id = $1 AND pr.production_date >= $2 AND pr.production_date <= $3`,
        [companyId, dateFrom, dateTo],
    );
    return result.rows;
}
