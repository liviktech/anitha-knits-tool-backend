import type pg from 'pg';
import { query, queryOne } from '../db/query.js';
import { withReadClient, withTransaction } from '../db/transaction.js';
import type { InventoryType } from '../types/enums.js';

export interface OpeningBalanceRawMaterialRow {
    id: string;
    groupId: string;
    date: Date;
    type: InventoryType;
    name: string;
    weightKg: number;
    bagCount: number | null;
    brand: { id: string; name: string } | null;
    chemical: { id: string; name: string } | null;
    color: { id: string; name: string } | null;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

interface QueryRow {
    id: string;
    groupId: string;
    date: Date;
    type: InventoryType;
    name: string;
    weightKg: number;
    bagCount: number | null;
    brandId: string | null;
    brandName: string | null;
    chemicalId: string | null;
    chemicalName: string | null;
    colorId: string | null;
    colorName: string | null;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

const SELECT_SQL = `
    SELECT r.id, r.group_id AS "groupId", r.date, r.type, r.name, r.weight_kg AS "weightKg", r.bag_count AS "bagCount",
           b.id AS "brandId", b.name AS "brandName", ch.id AS "chemicalId", ch.name AS "chemicalName",
           c.id AS "colorId", c.name AS "colorName",
           r.created_at AS "createdAt", r.created_by AS "createdBy", r.updated_at AS "updatedAt", r.updated_by AS "updatedBy"
    FROM opening_balance_raw_materials r
    LEFT JOIN brands b ON b.id = r.brand_id
    LEFT JOIN chemicals ch ON ch.id = r.chemical_id
    LEFT JOIN colors c ON c.id = r.color_id
`;

function toRow(row: QueryRow): OpeningBalanceRawMaterialRow {
    return {
        id: row.id,
        groupId: row.groupId,
        date: row.date,
        type: row.type,
        name: row.name,
        weightKg: row.weightKg,
        bagCount: row.bagCount,
        brand: row.brandId ? { id: row.brandId, name: row.brandName! } : null,
        chemical: row.chemicalId ? { id: row.chemicalId, name: row.chemicalName! } : null,
        color: row.colorId ? { id: row.colorId, name: row.colorName! } : null,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
    };
}

export interface ItemRefRow {
    type: InventoryType;
    brandId?: string;
    chemicalId?: string;
    colorId?: string;
}

export interface InsertRawMaterialItemInput {
    companyId: string;
    groupId: string;
    name: string;
    weightKg: number;
    bagCount?: number | null;
    actor: string;
    date: Date;
    ref: ItemRefRow;
}

async function insertItem(client: pg.PoolClient, input: InsertRawMaterialItemInput): Promise<OpeningBalanceRawMaterialRow> {
    const result = await client.query<QueryRow>(
        `WITH inserted AS (
            INSERT INTO opening_balance_raw_materials (id, company_id, group_id, date, type, name, weight_kg, bag_count, brand_id, chemical_id, color_id, created_by, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
            RETURNING *
         )
         SELECT r.id, r.group_id AS "groupId", r.date, r.type, r.name, r.weight_kg AS "weightKg", r.bag_count AS "bagCount",
                b.id AS "brandId", b.name AS "brandName", ch.id AS "chemicalId", ch.name AS "chemicalName",
                c.id AS "colorId", c.name AS "colorName",
                r.created_at AS "createdAt", r.created_by AS "createdBy", r.updated_at AS "updatedAt", r.updated_by AS "updatedBy"
         FROM inserted r
         LEFT JOIN brands b ON b.id = r.brand_id
         LEFT JOIN chemicals ch ON ch.id = r.chemical_id
         LEFT JOIN colors c ON c.id = r.color_id`,
        [
            input.companyId,
            input.groupId,
            input.date,
            input.ref.type,
            input.name,
            input.weightKg,
            input.bagCount ?? null,
            input.ref.brandId ?? null,
            input.ref.chemicalId ?? null,
            input.ref.colorId ?? null,
            input.actor,
        ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into opening_balance_raw_materials returned no row');
    return toRow(row);
}

/** Creates N rows sharing one groupId (one date's worth of HDPE/chemical/color items), atomically. */
export async function createRawMaterialBatch(items: InsertRawMaterialItemInput[]): Promise<OpeningBalanceRawMaterialRow[]> {
    return withTransaction(async (client) => {
        const rows: OpeningBalanceRawMaterialRow[] = [];
        for (const item of items) {
            rows.push(await insertItem(client, item));
        }
        return rows;
    });
}

export interface ListRawMaterialFilter {
    dateFrom?: Date;
    dateTo?: Date;
    type?: InventoryType;
}

export async function listRawMaterials(
    companyId: string,
    filter: ListRawMaterialFilter,
    skip: number,
    take: number,
): Promise<{ rows: OpeningBalanceRawMaterialRow[]; total: number }> {
    const conditions = ['r.company_id = $1'];
    const values: unknown[] = [companyId];
    if (filter.dateFrom) {
        values.push(filter.dateFrom);
        conditions.push(`r.date >= $${values.length}`);
    }
    if (filter.dateTo) {
        values.push(filter.dateTo);
        conditions.push(`r.date <= $${values.length}`);
    }
    if (filter.type) {
        values.push(filter.type);
        conditions.push(`r.type = $${values.length}`);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<QueryRow>(
            `${SELECT_SQL} ${whereSql}
             ORDER BY r.date DESC, r.created_at DESC
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM opening_balance_raw_materials r ${whereSql}`,
            values,
        );
        return { rows: rowsResult.rows.map(toRow), total: Number(countResult.rows[0]?.count ?? 0) };
    });
}

export interface GroupExistingRow {
    createdBy: string;
    createdAt: Date;
}

export async function findRawMaterialGroupExisting(groupId: string, companyId: string): Promise<GroupExistingRow | null> {
    return queryOne<GroupExistingRow>(
        'SELECT created_by AS "createdBy", created_at AS "createdAt" FROM opening_balance_raw_materials WHERE group_id = $1 AND company_id = $2 LIMIT 1',
        [groupId, companyId],
    );
}

/** Replaces a whole group atomically: delete-then-recreate (matches Inventory's own convention — row identity changes on every "update"). */
export async function replaceRawMaterialGroup(
    groupId: string,
    companyId: string,
    items: Omit<InsertRawMaterialItemInput, 'groupId'>[],
): Promise<OpeningBalanceRawMaterialRow[]> {
    return withTransaction(async (client) => {
        await client.query('DELETE FROM opening_balance_raw_materials WHERE group_id = $1 AND company_id = $2', [groupId, companyId]);
        const rows: OpeningBalanceRawMaterialRow[] = [];
        for (const item of items) {
            rows.push(await insertItem(client, { ...item, groupId }));
        }
        return rows;
    });
}

export async function findRawMaterialGroupIds(groupId: string, companyId: string): Promise<string[]> {
    const result = await query<{ id: string }>('SELECT id FROM opening_balance_raw_materials WHERE group_id = $1 AND company_id = $2', [
        groupId,
        companyId,
    ]);
    return result.rows.map((r) => r.id);
}

export async function deleteRawMaterialGroup(groupId: string, companyId: string): Promise<void> {
    await query('DELETE FROM opening_balance_raw_materials WHERE group_id = $1 AND company_id = $2', [groupId, companyId]);
}
