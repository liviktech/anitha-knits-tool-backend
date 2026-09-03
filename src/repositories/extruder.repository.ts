import type pg from 'pg';
import { query, queryOne } from '../db/query.js';
import { withReadClient } from '../db/transaction.js';
import { findWastagesByProductionRecordId, findWastagesByProductionRecordIds, type WastageRow } from './wastage.repository.js';
import type { ProductionListFilters } from '../utils/productionFilters.js';
import { buildProductionWhere } from '../utils/productionFilters.js';
import { ProductionStage } from '../types/enums.js';

export interface ExtruderRecordRow {
    id: string;
    stage: string;
    productionDate: Date;
    remarks: string | null;
    color: { id: string; name: string };
    size: { id: string; name: string };
    extruder: {
        brand: { id: string; name: string };
        rawMaterialKg: number;
        chemical: { id: string; name: string };
        chemicalKg: number;
        colorConsumedKg: number;
        yarnOutputKg: number;
        isRecipeOverridden: boolean;
        overrideReason: string | null;
        bagCount: number | null;
        bagWeightKg: number | null;
        looseWeightKg: number | null;
        totalWeightKg: number | null;
    } | null;
    wastages: WastageRow[];
    isApproved: boolean;
    approvedAt: Date | null;
    approvedBy: string | null;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

interface ExtruderQueryRow {
    id: string;
    stage: string;
    productionDate: Date;
    remarks: string | null;
    colorId: string;
    colorName: string;
    sizeId: string;
    sizeName: string;
    brandId: string | null;
    brandName: string | null;
    rawMaterialKg: number | null;
    chemicalId: string | null;
    chemicalName: string | null;
    chemicalKg: number | null;
    colorConsumedKg: number | null;
    yarnOutputKg: number | null;
    isRecipeOverridden: boolean | null;
    overrideReason: string | null;
    bagCount: number | null;
    bagWeightKg: number | null;
    looseWeightKg: number | null;
    totalWeightKg: number | null;
    isApproved: boolean;
    approvedAt: Date | null;
    approvedBy: string | null;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

const EXTRUDER_SELECT_SQL = `
    SELECT pr.id, pr.stage, pr.production_date AS "productionDate", pr.remarks,
           c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName",
           b.id AS "brandId", b.name AS "brandName", ed.raw_material_kg AS "rawMaterialKg",
           ch.id AS "chemicalId", ch.name AS "chemicalName", ed.chemical_kg AS "chemicalKg",
           ed.color_consumed_kg AS "colorConsumedKg", ed.yarn_output_kg AS "yarnOutputKg",
           ed.is_recipe_overridden AS "isRecipeOverridden", ed.override_reason AS "overrideReason",
           ed.bag_count AS "bagCount", ed.bag_weight_kg AS "bagWeightKg", ed.loose_weight_kg AS "looseWeightKg",
           ed.total_weight_kg AS "totalWeightKg",
           pr.is_approved AS "isApproved", pr.approved_at AS "approvedAt", pr.approved_by AS "approvedBy",
           pr.created_at AS "createdAt", pr.created_by AS "createdBy", pr.updated_at AS "updatedAt", pr.updated_by AS "updatedBy"
    FROM production_records pr
    JOIN colors c ON c.id = pr.color_id
    JOIN sizes s ON s.id = pr.size_id
    LEFT JOIN extruder_details ed ON ed.production_record_id = pr.id
    LEFT JOIN brands b ON b.id = ed.brand_id
    LEFT JOIN chemicals ch ON ch.id = ed.chemical_id
`;

function toExtruderRow(row: ExtruderQueryRow, wastages: WastageRow[]): ExtruderRecordRow {
    return {
        id: row.id,
        stage: row.stage,
        productionDate: row.productionDate,
        remarks: row.remarks,
        color: { id: row.colorId, name: row.colorName },
        size: { id: row.sizeId, name: row.sizeName },
        extruder: row.brandId
            ? {
                  brand: { id: row.brandId, name: row.brandName! },
                  rawMaterialKg: row.rawMaterialKg!,
                  chemical: { id: row.chemicalId!, name: row.chemicalName! },
                  chemicalKg: row.chemicalKg!,
                  colorConsumedKg: row.colorConsumedKg!,
                  yarnOutputKg: row.yarnOutputKg!,
                  isRecipeOverridden: row.isRecipeOverridden!,
                  overrideReason: row.overrideReason,
                  bagCount: row.bagCount,
                  bagWeightKg: row.bagWeightKg,
                  looseWeightKg: row.looseWeightKg,
                  totalWeightKg: row.totalWeightKg,
              }
            : null,
        wastages,
        isApproved: row.isApproved,
        approvedAt: row.approvedAt,
        approvedBy: row.approvedBy,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
    };
}

export interface CreateExtruderInputRow {
    companyId: string;
    productionDate: Date;
    colorId: string;
    sizeId: string;
    type: string;
    remarks?: string | null;
    actor: string;
    brandId: string;
    rawMaterialKg: number;
    chemicalId: string;
    chemicalKg: number;
    colorConsumedKg: number;
    yarnOutputKg: number;
    isRecipeOverridden: boolean;
    overrideReason: string | null;
    bagCount?: number | null;
    bagWeightKg?: number | null;
    looseWeightKg?: number | null;
    totalWeightKg?: number | null;
}

/** Inserts the ProductionRecord + its 1:1 ExtruderDetail atomically — always call within `withTransaction`. */
export async function insertExtruderProduction(client: pg.PoolClient, input: CreateExtruderInputRow): Promise<string> {
    const prResult = await client.query<{ id: string }>(
        `INSERT INTO production_records (id, company_id, stage, production_date, color_id, size_id, type, remarks, created_by, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, now())
         RETURNING id`,
        [input.companyId, ProductionStage.EXTRUDER, input.productionDate, input.colorId, input.sizeId, input.type, input.remarks ?? null, input.actor],
    );
    const productionRecordId = prResult.rows[0]!.id;

    await client.query(
        `INSERT INTO extruder_details (
            id, production_record_id, brand_id, raw_material_kg, chemical_id, chemical_kg, color_consumed_kg, yarn_output_kg,
            is_recipe_overridden, override_reason, bag_count, bag_weight_kg, loose_weight_kg, total_weight_kg
         ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
            productionRecordId,
            input.brandId,
            input.rawMaterialKg,
            input.chemicalId,
            input.chemicalKg,
            input.colorConsumedKg,
            input.yarnOutputKg,
            input.isRecipeOverridden,
            input.overrideReason,
            input.bagCount ?? null,
            input.bagWeightKg ?? null,
            input.looseWeightKg ?? null,
            input.totalWeightKg ?? null,
        ],
    );

    return productionRecordId;
}

/** Re-fetches a record mid-transaction (e.g. right after an update) — must run on the same `client` so it sees the transaction's own uncommitted writes. */
export async function findExtruderProductionByIdTx(client: pg.PoolClient, id: string): Promise<ExtruderRecordRow> {
    const result = await client.query<ExtruderQueryRow>(`${EXTRUDER_SELECT_SQL} WHERE pr.id = $1 AND pr.stage = $2`, [id, ProductionStage.EXTRUDER]);
    const row = result.rows[0];
    if (!row) throw new Error(`production_records ${id} not found after write`);
    const wastages = await findWastagesByProductionRecordId(id, client);
    return toExtruderRow(row, wastages);
}

export async function getExtruderProductionById(id: string, companyId: string): Promise<ExtruderRecordRow | null> {
    const result = await query<ExtruderQueryRow>(`${EXTRUDER_SELECT_SQL} WHERE pr.id = $1 AND pr.company_id = $2 AND pr.stage = $3`, [
        id,
        companyId,
        ProductionStage.EXTRUDER,
    ]);
    const row = result.rows[0];
    if (!row) return null;
    const wastages = await findWastagesByProductionRecordId(id);
    return toExtruderRow(row, wastages);
}

export async function listExtruderProductions(
    filters: ProductionListFilters,
    companyId: string,
    skip: number,
    take: number,
): Promise<{ rows: ExtruderRecordRow[]; total: number }> {
    const { conditions, values } = buildProductionWhere(ProductionStage.EXTRUDER, filters, companyId);
    const whereSql = `WHERE ${conditions.map((c) => `pr.${c}`).join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<ExtruderQueryRow>(
            `${EXTRUDER_SELECT_SQL} ${whereSql}
             ORDER BY pr.production_date DESC, pr.created_at DESC
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM production_records pr ${whereSql}`, values);
        const ids = rowsResult.rows.map((r) => r.id);
        const wastageMap = await findWastagesByProductionRecordIds(ids);
        return {
            rows: rowsResult.rows.map((row) => toExtruderRow(row, wastageMap.get(row.id) ?? [])),
            total: Number(countResult.rows[0]?.count ?? 0),
        };
    });
}

export interface ExtruderExistingRow {
    id: string;
    colorId: string;
    productionDate: Date;
    isApproved: boolean;
    rawMaterialKg: number | null;
}

export async function findExtruderExisting(id: string, companyId: string): Promise<ExtruderExistingRow | null> {
    return queryOne<ExtruderExistingRow>(
        `SELECT pr.id, pr.color_id AS "colorId", pr.production_date AS "productionDate", pr.is_approved AS "isApproved",
                ed.raw_material_kg AS "rawMaterialKg"
         FROM production_records pr
         LEFT JOIN extruder_details ed ON ed.production_record_id = pr.id
         WHERE pr.id = $1 AND pr.company_id = $2 AND pr.stage = $3`,
        [id, companyId, ProductionStage.EXTRUDER],
    );
}

export async function existsExtruderInCompany(id: string, companyId: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM production_records WHERE id = $1 AND company_id = $2 AND stage = $3) AS exists',
        [id, companyId, ProductionStage.EXTRUDER],
    );
    return row?.exists ?? false;
}

export interface UpdateExtruderHeaderPatch {
    productionDate?: Date;
    colorId?: string;
    sizeId?: string;
    remarks?: string;
    actor: string;
}

export async function updateExtruderHeader(client: pg.PoolClient, id: string, patch: UpdateExtruderHeaderPatch): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (patch.productionDate !== undefined) {
        values.push(patch.productionDate);
        sets.push(`production_date = $${values.length}`);
    }
    if (patch.colorId !== undefined) {
        values.push(patch.colorId);
        sets.push(`color_id = $${values.length}`);
    }
    if (patch.sizeId !== undefined) {
        values.push(patch.sizeId);
        sets.push(`size_id = $${values.length}`);
    }
    if (patch.remarks !== undefined) {
        values.push(patch.remarks);
        sets.push(`remarks = $${values.length}`);
    }
    values.push(patch.actor);
    sets.push(`updated_by = $${values.length}`);
    values.push(id);
    await client.query(`UPDATE production_records SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);
}

export interface UpdateExtruderDetailPatch {
    brandId?: string;
    rawMaterialKg?: number;
    chemicalId?: string;
    chemicalKg?: number;
    yarnOutputKg?: number;
    bagCount?: number | null;
    bagWeightKg?: number | null;
    looseWeightKg?: number | null;
    totalWeightKg?: number | null;
    colorConsumedKg?: number;
    isRecipeOverridden?: boolean;
    overrideReason?: string | null;
}

export async function updateExtruderDetail(client: pg.PoolClient, productionRecordId: string, patch: UpdateExtruderDetailPatch): Promise<void> {
    const columns: Record<keyof UpdateExtruderDetailPatch, string> = {
        brandId: 'brand_id',
        rawMaterialKg: 'raw_material_kg',
        chemicalId: 'chemical_id',
        chemicalKg: 'chemical_kg',
        yarnOutputKg: 'yarn_output_kg',
        bagCount: 'bag_count',
        bagWeightKg: 'bag_weight_kg',
        looseWeightKg: 'loose_weight_kg',
        totalWeightKg: 'total_weight_kg',
        colorConsumedKg: 'color_consumed_kg',
        isRecipeOverridden: 'is_recipe_overridden',
        overrideReason: 'override_reason',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(columns) as [keyof UpdateExtruderDetailPatch, string][]) {
        if (patch[key] === undefined) continue;
        values.push(patch[key]);
        sets.push(`${column} = $${values.length}`);
    }
    if (sets.length === 0) return;
    values.push(productionRecordId);
    await client.query(`UPDATE extruder_details SET ${sets.join(', ')} WHERE production_record_id = $${values.length}`, values);
}

export async function deleteWastagesForProduction(client: pg.PoolClient, productionRecordId: string): Promise<void> {
    await client.query('DELETE FROM wastage_records WHERE production_record_id = $1', [productionRecordId]);
}

export async function deleteProductionRecord(client: pg.PoolClient, id: string): Promise<void> {
    await client.query('DELETE FROM production_records WHERE id = $1', [id]);
}

export async function approveProductionRecord(id: string, actor: string): Promise<void> {
    await query('UPDATE production_records SET is_approved = true, approved_at = now(), approved_by = $1 WHERE id = $2', [actor, id]);
}

export interface ExtruderSummaryRow {
    colorId: string | null;
    colorName: string | null;
    yarnOutputKg: number | null;
}

export async function findExtruderRowsForSummary(companyId: string, dateFrom: Date, dateTo: Date): Promise<ExtruderSummaryRow[]> {
    const result = await query<ExtruderSummaryRow>(
        `SELECT c.id AS "colorId", c.name AS "colorName", ed.yarn_output_kg AS "yarnOutputKg"
         FROM production_records pr
         LEFT JOIN colors c ON c.id = pr.color_id
         LEFT JOIN extruder_details ed ON ed.production_record_id = pr.id
         WHERE pr.company_id = $1 AND pr.stage = $2 AND pr.production_date >= $3 AND pr.production_date <= $4`,
        [companyId, ProductionStage.EXTRUDER, dateFrom, dateTo],
    );
    return result.rows;
}
