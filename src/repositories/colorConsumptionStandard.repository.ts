import { query, queryOne } from '../db/query.js';
import { withReadClient } from '../db/transaction.js';

export interface ColorConsumptionStandardRow {
    id: string;
    companyId: string;
    basisWeightKg: number;
    hdpematerialbag: number;
    whiteKgBasis: number;
    blueKgBasis: number;
    greenKgBasis: number;
    chemicalWeight: number | null;
    date: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const COLUMNS_SQL = `
    id, company_id AS "companyId", basis_weight_kg AS "basisWeightKg", hdpe_material_bag AS "hdpematerialbag",
    white_kg_basis AS "whiteKgBasis", blue_kg_basis AS "blueKgBasis", green_kg_basis AS "greenKgBasis",
    chemical_weight_kg AS "chemicalWeight", date, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
`;

export async function findLatestStandardRow(companyId: string, dateOnly: Date): Promise<ColorConsumptionStandardRow | null> {
    return queryOne<ColorConsumptionStandardRow>(
        `SELECT ${COLUMNS_SQL} FROM color_consumption_standards
         WHERE company_id = $1 AND date <= $2
         ORDER BY date DESC, created_at DESC
         LIMIT 1`,
        [companyId, dateOnly],
    );
}

export async function listColorConsumptionStandards(
    companyId: string,
    skip: number,
    take: number,
): Promise<{ rows: ColorConsumptionStandardRow[]; total: number }> {
    return withReadClient(async (client) => {
        const rowsResult = await client.query<ColorConsumptionStandardRow>(
            `SELECT ${COLUMNS_SQL} FROM color_consumption_standards WHERE company_id = $1
             ORDER BY date DESC, created_at DESC
             LIMIT $2 OFFSET $3`,
            [companyId, take, skip],
        );
        const countResult = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM color_consumption_standards WHERE company_id = $1', [
            companyId,
        ]);
        return { rows: rowsResult.rows, total: Number(countResult.rows[0]?.count ?? 0) };
    });
}

export async function insertColorConsumptionStandard(input: {
    companyId: string;
    basisWeightKg: number;
    hdpematerialbag: number;
    whiteKgBasis: number;
    blueKgBasis: number;
    greenKgBasis: number;
    chemicalWeight?: number | null;
    date?: Date | null;
    isActive?: boolean;
    actor: string;
}): Promise<ColorConsumptionStandardRow> {
    const row = await queryOne<ColorConsumptionStandardRow>(
        `INSERT INTO color_consumption_standards
            (id, company_id, basis_weight_kg, hdpe_material_bag, white_kg_basis, blue_kg_basis, green_kg_basis, chemical_weight_kg, date, is_active, created_by, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, true), $10, now())
         RETURNING ${COLUMNS_SQL}`,
        [
            input.companyId,
            input.basisWeightKg,
            input.hdpematerialbag,
            input.whiteKgBasis,
            input.blueKgBasis,
            input.greenKgBasis,
            input.chemicalWeight ?? null,
            input.date ?? null,
            input.isActive ?? null,
            input.actor,
        ],
    );
    if (!row) throw new Error('Insert into color_consumption_standards returned no row');
    return row;
}

export async function existsStandardInCompany(id: string, companyId: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM color_consumption_standards WHERE id = $1 AND company_id = $2) AS exists',
        [id, companyId],
    );
    return row?.exists ?? false;
}

export interface UpdateStandardPatch {
    date?: Date;
    basisWeightKg?: number;
    hdpematerialbag?: number;
    whiteKgBasis?: number;
    blueKgBasis?: number;
    greenKgBasis?: number;
    chemicalWeight?: number | null;
    isActive?: boolean;
}

export async function updateColorConsumptionStandard(id: string, patch: UpdateStandardPatch, actor: string): Promise<ColorConsumptionStandardRow> {
    const columns: Record<keyof UpdateStandardPatch, string> = {
        date: 'date',
        basisWeightKg: 'basis_weight_kg',
        hdpematerialbag: 'hdpe_material_bag',
        whiteKgBasis: 'white_kg_basis',
        blueKgBasis: 'blue_kg_basis',
        greenKgBasis: 'green_kg_basis',
        chemicalWeight: 'chemical_weight_kg',
        isActive: 'is_active',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(columns) as [keyof UpdateStandardPatch, string][]) {
        if (patch[key] === undefined) continue;
        values.push(patch[key]);
        sets.push(`${column} = $${values.length}`);
    }
    values.push(actor);
    sets.push(`updated_by = $${values.length}`);
    values.push(id);
    const row = await queryOne<ColorConsumptionStandardRow>(
        `UPDATE color_consumption_standards SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING ${COLUMNS_SQL}`,
        values,
    );
    if (!row) throw new Error(`Update on color_consumption_standards returned no row for id ${id}`);
    return row;
}

export async function deleteColorConsumptionStandard(id: string): Promise<void> {
    await query('DELETE FROM color_consumption_standards WHERE id = $1', [id]);
}
