import { query, queryOne } from '../db/query.js';
import { withReadClient } from '../db/transaction.js';

export interface OpeningBalanceWastageRow {
    id: string;
    date: Date;
    color: { id: string; name: string } | null;
    size: { id: string; name: string } | null;
    chemical: { id: string; name: string } | null;
    extruderLumpsKg: number;
    extruderLoomsWasteKg: number;
    loomsYarnWasteKg: number;
    fabricWasteKg: number;
    fabricBitwasteKg: number;
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
    chemicalId: string | null;
    chemicalName: string | null;
    extruderLumpsKg: number;
    extruderLoomsWasteKg: number;
    loomsYarnWasteKg: number;
    fabricWasteKg: number;
    fabricBitwasteKg: number;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

const SELECT_SQL = `
    SELECT w.id, w.date, c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName",
           ch.id AS "chemicalId", ch.name AS "chemicalName",
           w.extruder_lumps_kg AS "extruderLumpsKg", w.extruder_looms_waste_kg AS "extruderLoomsWasteKg",
           w.looms_yarn_waste_kg AS "loomsYarnWasteKg", w.fabric_waste_kg AS "fabricWasteKg", w.fabric_bitwaste_kg AS "fabricBitwasteKg",
           w.created_at AS "createdAt", w.created_by AS "createdBy", w.updated_at AS "updatedAt", w.updated_by AS "updatedBy"
    FROM opening_balance_wastage w
    LEFT JOIN colors c ON c.id = w.color_id
    LEFT JOIN sizes s ON s.id = w.size_id
    LEFT JOIN chemicals ch ON ch.id = w.chemical_id
`;

function toRow(row: QueryRow): OpeningBalanceWastageRow {
    return {
        id: row.id,
        date: row.date,
        color: row.colorId ? { id: row.colorId, name: row.colorName! } : null,
        size: row.sizeId ? { id: row.sizeId, name: row.sizeName! } : null,
        chemical: row.chemicalId ? { id: row.chemicalId, name: row.chemicalName! } : null,
        extruderLumpsKg: row.extruderLumpsKg,
        extruderLoomsWasteKg: row.extruderLoomsWasteKg,
        loomsYarnWasteKg: row.loomsYarnWasteKg,
        fabricWasteKg: row.fabricWasteKg,
        fabricBitwasteKg: row.fabricBitwasteKg,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
    };
}

export interface InsertWastageInput {
    companyId: string;
    date: Date;
    colorId?: string | null;
    sizeId?: string | null;
    chemicalId?: string | null;
    extruderLumpsKg: number;
    extruderLoomsWasteKg: number;
    loomsYarnWasteKg: number;
    fabricWasteKg: number;
    fabricBitwasteKg: number;
    actor: string;
}

async function insertOne(input: InsertWastageInput): Promise<OpeningBalanceWastageRow> {
    const row = await queryOne<QueryRow>(
        `WITH inserted AS (
            INSERT INTO opening_balance_wastage
                (id, company_id, date, color_id, size_id, chemical_id, extruder_lumps_kg, extruder_looms_waste_kg, looms_yarn_waste_kg, fabric_waste_kg, fabric_bitwaste_kg, created_by, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
            RETURNING *
         )
         SELECT w.id, w.date, c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName",
                ch.id AS "chemicalId", ch.name AS "chemicalName",
                w.extruder_lumps_kg AS "extruderLumpsKg", w.extruder_looms_waste_kg AS "extruderLoomsWasteKg",
                w.looms_yarn_waste_kg AS "loomsYarnWasteKg", w.fabric_waste_kg AS "fabricWasteKg", w.fabric_bitwaste_kg AS "fabricBitwasteKg",
                w.created_at AS "createdAt", w.created_by AS "createdBy", w.updated_at AS "updatedAt", w.updated_by AS "updatedBy"
         FROM inserted w
         LEFT JOIN colors c ON c.id = w.color_id
         LEFT JOIN sizes s ON s.id = w.size_id
         LEFT JOIN chemicals ch ON ch.id = w.chemical_id`,
        [
            input.companyId,
            input.date,
            input.colorId ?? null,
            input.sizeId ?? null,
            input.chemicalId ?? null,
            input.extruderLumpsKg,
            input.extruderLoomsWasteKg,
            input.loomsYarnWasteKg,
            input.fabricWasteKg,
            input.fabricBitwasteKg,
            input.actor,
        ],
    );
    if (!row) throw new Error('Insert into opening_balance_wastage returned no row');
    return toRow(row);
}

export async function createWastage(input: InsertWastageInput): Promise<OpeningBalanceWastageRow> {
    return insertOne(input);
}

/** Inserts N rows in one round trip (the modal's "Add Row" multi-row create). */
export async function createWastageBatch(items: InsertWastageInput[]): Promise<OpeningBalanceWastageRow[]> {
    const rows: OpeningBalanceWastageRow[] = [];
    for (const item of items) {
        rows.push(await insertOne(item));
    }
    return rows;
}

export interface ListWastageFilter {
    dateFrom?: Date;
    dateTo?: Date;
    colorId?: string;
    sizeId?: string;
}

export async function listWastage(
    companyId: string,
    filter: ListWastageFilter,
    skip: number,
    take: number,
): Promise<{ rows: OpeningBalanceWastageRow[]; total: number }> {
    const conditions = ['w.company_id = $1'];
    const values: unknown[] = [companyId];
    if (filter.dateFrom) {
        values.push(filter.dateFrom);
        conditions.push(`w.date >= $${values.length}`);
    }
    if (filter.dateTo) {
        values.push(filter.dateTo);
        conditions.push(`w.date <= $${values.length}`);
    }
    if (filter.colorId) {
        values.push(filter.colorId);
        conditions.push(`w.color_id = $${values.length}`);
    }
    if (filter.sizeId) {
        values.push(filter.sizeId);
        conditions.push(`w.size_id = $${values.length}`);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<QueryRow>(
            `${SELECT_SQL} ${whereSql}
             ORDER BY w.date DESC, w.created_at DESC
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM opening_balance_wastage w ${whereSql}`, values);
        return { rows: rowsResult.rows.map(toRow), total: Number(countResult.rows[0]?.count ?? 0) };
    });
}

export async function findWastageById(id: string, companyId: string): Promise<OpeningBalanceWastageRow | null> {
    const result = await query<QueryRow>(`${SELECT_SQL} WHERE w.id = $1 AND w.company_id = $2`, [id, companyId]);
    const row = result.rows[0];
    return row ? toRow(row) : null;
}

export interface UpdateWastagePatch {
    date?: Date;
    colorId?: string | null;
    sizeId?: string | null;
    chemicalId?: string | null;
    extruderLumpsKg?: number;
    extruderLoomsWasteKg?: number;
    loomsYarnWasteKg?: number;
    fabricWasteKg?: number;
    fabricBitwasteKg?: number;
}

export async function updateWastage(id: string, companyId: string, patch: UpdateWastagePatch, actor: string): Promise<OpeningBalanceWastageRow> {
    const columns: Record<keyof UpdateWastagePatch, string> = {
        date: 'date',
        colorId: 'color_id',
        sizeId: 'size_id',
        chemicalId: 'chemical_id',
        extruderLumpsKg: 'extruder_lumps_kg',
        extruderLoomsWasteKg: 'extruder_looms_waste_kg',
        loomsYarnWasteKg: 'looms_yarn_waste_kg',
        fabricWasteKg: 'fabric_waste_kg',
        fabricBitwasteKg: 'fabric_bitwaste_kg',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(columns) as [keyof UpdateWastagePatch, string][]) {
        if (patch[key] === undefined) continue;
        values.push(patch[key]);
        sets.push(`${column} = $${values.length}`);
    }
    values.push(actor);
    sets.push(`updated_by = $${values.length}`);
    values.push(id);
    values.push(companyId);
    await query(`UPDATE opening_balance_wastage SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length - 1} AND company_id = $${values.length}`, values);

    const row = await findWastageById(id, companyId);
    if (!row) throw new Error(`Update on opening_balance_wastage returned no row for id ${id}`);
    return row;
}

export async function existsWastage(id: string, companyId: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM opening_balance_wastage WHERE id = $1 AND company_id = $2) AS exists', [
        id,
        companyId,
    ]);
    return row?.exists ?? false;
}

export async function deleteWastage(id: string, companyId: string): Promise<void> {
    await query('DELETE FROM opening_balance_wastage WHERE id = $1 AND company_id = $2', [id, companyId]);
}
