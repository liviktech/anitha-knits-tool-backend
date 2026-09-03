import { query, queryOne } from '../db/query.js';
import { withReadClient } from '../db/transaction.js';

export interface OpeningBalanceFabricStockRow {
    id: string;
    date: Date;
    color: { id: string; name: string } | null;
    size: { id: string; name: string } | null;
    koraBalanceKg: number;
    fabricStockKg: number;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

interface QueryRow {
    id: string;
    date: Date;
    colorId: string | null;
    colorName: string | null;
    sizeId: string | null;
    sizeName: string | null;
    koraBalanceKg: number;
    fabricStockKg: number;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

const SELECT_SQL = `
    SELECT f.id, f.date, c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName",
           f.kora_balance_kg AS "koraBalanceKg", f.fabric_stock_kg AS "fabricStockKg",
           f.created_at AS "createdAt", f.created_by AS "createdBy", f.updated_at AS "updatedAt", f.updated_by AS "updatedBy"
    FROM opening_balance_fabric_stock f
    LEFT JOIN colors c ON c.id = f.color_id
    LEFT JOIN sizes s ON s.id = f.size_id
`;

function toRow(row: QueryRow): OpeningBalanceFabricStockRow {
    return {
        id: row.id,
        date: row.date,
        color: row.colorId ? { id: row.colorId, name: row.colorName! } : null,
        size: row.sizeId ? { id: row.sizeId, name: row.sizeName! } : null,
        koraBalanceKg: row.koraBalanceKg,
        fabricStockKg: row.fabricStockKg,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
    };
}

export interface InsertFabricStockInput {
    companyId: string;
    date: Date;
    colorId?: string | null;
    sizeId?: string | null;
    koraBalanceKg: number;
    fabricStockKg: number;
    actor: string;
}

async function insertOne(input: InsertFabricStockInput): Promise<OpeningBalanceFabricStockRow> {
    const row = await queryOne<QueryRow>(
        `WITH inserted AS (
            INSERT INTO opening_balance_fabric_stock (id, company_id, date, color_id, size_id, kora_balance_kg, fabric_stock_kg, created_by, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, now())
            RETURNING *
         )
         SELECT f.id, f.date, c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName",
                f.kora_balance_kg AS "koraBalanceKg", f.fabric_stock_kg AS "fabricStockKg",
                f.created_at AS "createdAt", f.created_by AS "createdBy", f.updated_at AS "updatedAt", f.updated_by AS "updatedBy"
         FROM inserted f
         LEFT JOIN colors c ON c.id = f.color_id
         LEFT JOIN sizes s ON s.id = f.size_id`,
        [input.companyId, input.date, input.colorId ?? null, input.sizeId ?? null, input.koraBalanceKg, input.fabricStockKg, input.actor],
    );
    if (!row) throw new Error('Insert into opening_balance_fabric_stock returned no row');
    return toRow(row);
}

export async function createFabricStock(input: InsertFabricStockInput): Promise<OpeningBalanceFabricStockRow> {
    return insertOne(input);
}

/** Inserts N rows in one round trip (the modal's "Add Row" multi-row create). */
export async function createFabricStockBatch(items: InsertFabricStockInput[]): Promise<OpeningBalanceFabricStockRow[]> {
    const rows: OpeningBalanceFabricStockRow[] = [];
    for (const item of items) {
        rows.push(await insertOne(item));
    }
    return rows;
}

export interface ListFabricStockFilter {
    dateFrom?: Date;
    dateTo?: Date;
    colorId?: string;
    sizeId?: string;
}

export async function listFabricStock(
    companyId: string,
    filter: ListFabricStockFilter,
    skip: number,
    take: number,
): Promise<{ rows: OpeningBalanceFabricStockRow[]; total: number }> {
    const conditions = ['f.company_id = $1'];
    const values: unknown[] = [companyId];
    if (filter.dateFrom) {
        values.push(filter.dateFrom);
        conditions.push(`f.date >= $${values.length}`);
    }
    if (filter.dateTo) {
        values.push(filter.dateTo);
        conditions.push(`f.date <= $${values.length}`);
    }
    if (filter.colorId) {
        values.push(filter.colorId);
        conditions.push(`f.color_id = $${values.length}`);
    }
    if (filter.sizeId) {
        values.push(filter.sizeId);
        conditions.push(`f.size_id = $${values.length}`);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<QueryRow>(
            `${SELECT_SQL} ${whereSql}
             ORDER BY f.date DESC, f.created_at DESC
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM opening_balance_fabric_stock f ${whereSql}`, values);
        return { rows: rowsResult.rows.map(toRow), total: Number(countResult.rows[0]?.count ?? 0) };
    });
}

export async function findFabricStockById(id: string, companyId: string): Promise<OpeningBalanceFabricStockRow | null> {
    const result = await query<QueryRow>(`${SELECT_SQL} WHERE f.id = $1 AND f.company_id = $2`, [id, companyId]);
    const row = result.rows[0];
    return row ? toRow(row) : null;
}

export interface UpdateFabricStockPatch {
    date?: Date;
    colorId?: string | null;
    sizeId?: string | null;
    koraBalanceKg?: number;
    fabricStockKg?: number;
}

export async function updateFabricStock(id: string, companyId: string, patch: UpdateFabricStockPatch, actor: string): Promise<OpeningBalanceFabricStockRow> {
    const columns: Record<keyof UpdateFabricStockPatch, string> = {
        date: 'date',
        colorId: 'color_id',
        sizeId: 'size_id',
        koraBalanceKg: 'kora_balance_kg',
        fabricStockKg: 'fabric_stock_kg',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(columns) as [keyof UpdateFabricStockPatch, string][]) {
        if (patch[key] === undefined) continue;
        values.push(patch[key]);
        sets.push(`${column} = $${values.length}`);
    }
    values.push(actor);
    sets.push(`updated_by = $${values.length}`);
    values.push(id);
    values.push(companyId);
    await query(
        `UPDATE opening_balance_fabric_stock SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length - 1} AND company_id = $${values.length}`,
        values,
    );

    const row = await findFabricStockById(id, companyId);
    if (!row) throw new Error(`Update on opening_balance_fabric_stock returned no row for id ${id}`);
    return row;
}

export async function existsFabricStock(id: string, companyId: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM opening_balance_fabric_stock WHERE id = $1 AND company_id = $2) AS exists',
        [id, companyId],
    );
    return row?.exists ?? false;
}

export async function deleteFabricStock(id: string, companyId: string): Promise<void> {
    await query('DELETE FROM opening_balance_fabric_stock WHERE id = $1 AND company_id = $2', [id, companyId]);
}
