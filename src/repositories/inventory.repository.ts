import type pg from 'pg';
import { query, queryOne } from '../db/query.js';
import { withReadClient, withTransaction } from '../db/transaction.js';
import type { InventoryType } from '../types/enums.js';

export interface InventoryRow {
    id: string;
    groupId: string | null;
    date: Date;
    type: InventoryType;
    name: string;
    weightKg: number;
    bagCount: number | null;
    DC_NUMBER: string;
    brand: { id: string; name: string } | null;
    chemical: { id: string; name: string } | null;
    color: { id: string; name: string } | null;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

interface InventoryQueryRow {
    id: string;
    groupId: string | null;
    date: Date;
    type: InventoryType;
    name: string;
    weightKg: number;
    bagCount: number | null;
    DC_NUMBER: string;
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

const INVENTORY_SELECT_SQL = `
    SELECT i.id, i.group_id AS "groupId", i.date, i.type, i.name, i.weight_kg AS "weightKg", i.bag_count AS "bagCount",
           i."DC_NUMBER", b.id AS "brandId", b.name AS "brandName", ch.id AS "chemicalId", ch.name AS "chemicalName",
           c.id AS "colorId", c.name AS "colorName",
           i.created_at AS "createdAt", i.created_by AS "createdBy", i.updated_at AS "updatedAt", i.updated_by AS "updatedBy"
    FROM inventory i
    LEFT JOIN brands b ON b.id = i.brand_id
    LEFT JOIN chemicals ch ON ch.id = i.chemical_id
    LEFT JOIN colors c ON c.id = i.color_id
`;

function toInventoryRow(row: InventoryQueryRow): InventoryRow {
    return {
        id: row.id,
        groupId: row.groupId,
        date: row.date,
        type: row.type,
        name: row.name,
        weightKg: row.weightKg,
        bagCount: row.bagCount,
        DC_NUMBER: row.DC_NUMBER,
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

export interface InsertInventoryItemInput {
    companyId: string;
    groupId: string;
    name: string;
    weightKg: number;
    bagCount?: number | null;
    DC_NUMBER: string;
    actor: string;
    date: Date;
    ref: ItemRefRow;
}

export async function insertInventoryItem(client: pg.PoolClient, input: InsertInventoryItemInput): Promise<InventoryRow> {
    const result = await client.query<InventoryQueryRow>(
        `WITH inserted AS (
            INSERT INTO inventory (id, company_id, group_id, name, weight_kg, bag_count, "DC_NUMBER", created_by, date, type, brand_id, chemical_id, color_id, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
            RETURNING *
         )
         SELECT i.id, i.group_id AS "groupId", i.date, i.type, i.name, i.weight_kg AS "weightKg", i.bag_count AS "bagCount",
                i."DC_NUMBER", b.id AS "brandId", b.name AS "brandName", ch.id AS "chemicalId", ch.name AS "chemicalName",
                c.id AS "colorId", c.name AS "colorName",
                i.created_at AS "createdAt", i.created_by AS "createdBy", i.updated_at AS "updatedAt", i.updated_by AS "updatedBy"
         FROM inserted i
         LEFT JOIN brands b ON b.id = i.brand_id
         LEFT JOIN chemicals ch ON ch.id = i.chemical_id
         LEFT JOIN colors c ON c.id = i.color_id`,
        [
            input.companyId,
            input.groupId,
            input.name,
            input.weightKg,
            input.bagCount ?? null,
            input.DC_NUMBER,
            input.actor,
            input.date,
            input.ref.type,
            input.ref.brandId ?? null,
            input.ref.chemicalId ?? null,
            input.ref.colorId ?? null,
        ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into inventory returned no row');
    return toInventoryRow(row);
}

/** Batch-creates N inventory rows sharing one groupId, atomically. */
export async function createInventoryBatch(items: InsertInventoryItemInput[]): Promise<InventoryRow[]> {
    return withTransaction(async (client) => {
        const rows: InventoryRow[] = [];
        for (const item of items) {
            rows.push(await insertInventoryItem(client, item));
        }
        return rows;
    });
}

export interface ListInventoryFilter {
    dateFrom?: Date;
    dateTo?: Date;
    type?: InventoryType;
    name?: string;
}

export async function listInventory(
    companyId: string,
    filter: ListInventoryFilter,
    skip: number,
    take: number,
): Promise<{ rows: InventoryRow[]; total: number }> {
    const conditions = ['i.company_id = $1'];
    const values: unknown[] = [companyId];
    if (filter.dateFrom) {
        values.push(filter.dateFrom);
        conditions.push(`i.date >= $${values.length}`);
    }
    if (filter.dateTo) {
        values.push(filter.dateTo);
        conditions.push(`i.date <= $${values.length}`);
    }
    if (filter.type) {
        values.push(filter.type);
        conditions.push(`i.type = $${values.length}`);
    }
    if (filter.name) {
        values.push(`%${filter.name}%`);
        conditions.push(`i.name ILIKE $${values.length}`);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<InventoryQueryRow>(
            `${INVENTORY_SELECT_SQL} ${whereSql}
             ORDER BY i.date DESC, i.created_at DESC
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM inventory i ${whereSql}`, values);
        return { rows: rowsResult.rows.map(toInventoryRow), total: Number(countResult.rows[0]?.count ?? 0) };
    });
}

export async function findInventoryById(id: string, companyId: string): Promise<InventoryRow | null> {
    const result = await query<InventoryQueryRow>(`${INVENTORY_SELECT_SQL} WHERE i.id = $1 AND i.company_id = $2`, [id, companyId]);
    const row = result.rows[0];
    return row ? toInventoryRow(row) : null;
}

export interface InventoryGroupExistingRow {
    createdBy: string;
    createdAt: Date;
}

export async function findInventoryGroupExisting(groupId: string, companyId: string): Promise<InventoryGroupExistingRow | null> {
    return queryOne<InventoryGroupExistingRow>(
        'SELECT created_by AS "createdBy", created_at AS "createdAt" FROM inventory WHERE group_id = $1 AND company_id = $2 LIMIT 1',
        [groupId, companyId],
    );
}

/** Replaces a whole intake group atomically: delete-then-recreate (matches the original's behavior — row identity changes on every "update"). */
export async function replaceInventoryGroup(
    groupId: string,
    companyId: string,
    items: Omit<InsertInventoryItemInput, 'groupId'>[],
): Promise<InventoryRow[]> {
    return withTransaction(async (client) => {
        await client.query('DELETE FROM inventory WHERE group_id = $1 AND company_id = $2', [groupId, companyId]);
        const rows: InventoryRow[] = [];
        for (const item of items) {
            rows.push(await insertInventoryItem(client, { ...item, groupId }));
        }
        return rows;
    });
}

export async function existsInventoryInCompany(id: string, companyId: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM inventory WHERE id = $1 AND company_id = $2) AS exists', [
        id,
        companyId,
    ]);
    return row?.exists ?? false;
}

export interface UpdateInventoryItemPatch {
    date?: Date;
    weightKg?: number;
    bagCount?: number;
    DC_NUMBER?: string;
}

export async function updateInventoryItem(id: string, patch: UpdateInventoryItemPatch, actor: string): Promise<InventoryRow> {
    const columns: Record<keyof UpdateInventoryItemPatch, string> = {
        date: 'date',
        weightKg: 'weight_kg',
        bagCount: 'bag_count',
        DC_NUMBER: '"DC_NUMBER"',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(columns) as [keyof UpdateInventoryItemPatch, string][]) {
        if (patch[key] === undefined) continue;
        values.push(patch[key]);
        sets.push(`${column} = $${values.length}`);
    }
    values.push(actor);
    sets.push(`updated_by = $${values.length}`);
    values.push(id);
    await query(`UPDATE inventory SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);

    const row = await findInventoryByIdNoCompanyCheck(id);
    if (!row) throw new Error(`Update on inventory returned no row for id ${id}`);
    return row;
}

async function findInventoryByIdNoCompanyCheck(id: string): Promise<InventoryRow | null> {
    const result = await query<InventoryQueryRow>(`${INVENTORY_SELECT_SQL} WHERE i.id = $1`, [id]);
    const row = result.rows[0];
    return row ? toInventoryRow(row) : null;
}

export async function findInventoryGroupIds(groupId: string, companyId: string): Promise<string[]> {
    const result = await query<{ id: string }>('SELECT id FROM inventory WHERE group_id = $1 AND company_id = $2', [groupId, companyId]);
    return result.rows.map((r) => r.id);
}

export async function deleteInventoryGroup(groupId: string, companyId: string): Promise<void> {
    await query('DELETE FROM inventory WHERE group_id = $1 AND company_id = $2', [groupId, companyId]);
}

export async function deleteInventoryItem(id: string): Promise<void> {
    await query('DELETE FROM inventory WHERE id = $1', [id]);
}

export async function findInventoryRowsForSummary(companyId: string, dateFrom: Date, dateTo: Date): Promise<InventoryRow[]> {
    const result = await query<InventoryQueryRow>(`${INVENTORY_SELECT_SQL} WHERE i.company_id = $1 AND i.date >= $2 AND i.date <= $3`, [
        companyId,
        dateFrom,
        dateTo,
    ]);
    return result.rows.map(toInventoryRow);
}
