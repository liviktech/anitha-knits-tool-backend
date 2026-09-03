import type pg from 'pg';
import { query, queryOne } from '../db/query.js';
import { withReadClient } from '../db/transaction.js';
import { findWastagesByProductionRecordId, findWastagesByProductionRecordIds, type WastageRow } from './wastage.repository.js';
import type { ProductionListFilters } from '../utils/productionFilters.js';
import { buildProductionWhere } from '../utils/productionFilters.js';
import { ProductionStage } from '../types/enums.js';

export interface LoomsRecordRow {
    id: string;
    stage: string;
    productionDate: Date;
    remarks: string | null;
    color: { id: string; name: string };
    size: { id: string; name: string };
    loom: { yarnInputKg: number; fabricOutputKg: number } | null;
    wastages: WastageRow[];
    isApproved: boolean;
    approvedAt: Date | null;
    approvedBy: string | null;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

interface LoomsQueryRow {
    id: string;
    stage: string;
    productionDate: Date;
    remarks: string | null;
    colorId: string;
    colorName: string;
    sizeId: string;
    sizeName: string;
    yarnInputKg: number | null;
    fabricOutputKg: number | null;
    isApproved: boolean;
    approvedAt: Date | null;
    approvedBy: string | null;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

const LOOMS_SELECT_SQL = `
    SELECT pr.id, pr.stage, pr.production_date AS "productionDate", pr.remarks,
           c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName",
           ld.yarn_input_kg AS "yarnInputKg", ld.fabric_output_kg AS "fabricOutputKg",
           pr.is_approved AS "isApproved", pr.approved_at AS "approvedAt", pr.approved_by AS "approvedBy",
           pr.created_at AS "createdAt", pr.created_by AS "createdBy", pr.updated_at AS "updatedAt", pr.updated_by AS "updatedBy"
    FROM production_records pr
    JOIN colors c ON c.id = pr.color_id
    JOIN sizes s ON s.id = pr.size_id
    LEFT JOIN loom_details ld ON ld.production_record_id = pr.id
`;

function toLoomsRow(row: LoomsQueryRow, wastages: WastageRow[]): LoomsRecordRow {
    return {
        id: row.id,
        stage: row.stage,
        productionDate: row.productionDate,
        remarks: row.remarks,
        color: { id: row.colorId, name: row.colorName },
        size: { id: row.sizeId, name: row.sizeName },
        loom: row.yarnInputKg !== null ? { yarnInputKg: row.yarnInputKg, fabricOutputKg: row.fabricOutputKg! } : null,
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

export interface CreateLoomsInputRow {
    companyId: string;
    productionDate: Date;
    colorId: string;
    sizeId: string;
    remarks?: string | null;
    actor: string;
    yarnInputKg: number;
    fabricOutputKg: number;
}

export async function insertLoomsProduction(client: pg.PoolClient, input: CreateLoomsInputRow): Promise<string> {
    const prResult = await client.query<{ id: string }>(
        `INSERT INTO production_records (id, company_id, stage, production_date, color_id, size_id, remarks, created_by, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, now())
         RETURNING id`,
        [input.companyId, ProductionStage.LOOMS, input.productionDate, input.colorId, input.sizeId, input.remarks ?? null, input.actor],
    );
    const productionRecordId = prResult.rows[0]!.id;

    await client.query(
        `INSERT INTO loom_details (id, production_record_id, yarn_input_kg, fabric_output_kg)
         VALUES (gen_random_uuid(), $1, $2, $3)`,
        [productionRecordId, input.yarnInputKg, input.fabricOutputKg],
    );

    return productionRecordId;
}

export async function findLoomsProductionByIdTx(client: pg.PoolClient, id: string): Promise<LoomsRecordRow> {
    const result = await client.query<LoomsQueryRow>(`${LOOMS_SELECT_SQL} WHERE pr.id = $1 AND pr.stage = $2`, [id, ProductionStage.LOOMS]);
    const row = result.rows[0];
    if (!row) throw new Error(`production_records ${id} not found after write`);
    const wastages = await findWastagesByProductionRecordId(id, client);
    return toLoomsRow(row, wastages);
}

export async function getLoomsProductionById(id: string, companyId: string): Promise<LoomsRecordRow | null> {
    const result = await query<LoomsQueryRow>(`${LOOMS_SELECT_SQL} WHERE pr.id = $1 AND pr.company_id = $2 AND pr.stage = $3`, [
        id,
        companyId,
        ProductionStage.LOOMS,
    ]);
    const row = result.rows[0];
    if (!row) return null;
    const wastages = await findWastagesByProductionRecordId(id);
    return toLoomsRow(row, wastages);
}

export async function listLoomsProductions(
    filters: ProductionListFilters,
    companyId: string,
    skip: number,
    take: number,
): Promise<{ rows: LoomsRecordRow[]; total: number }> {
    const { conditions, values } = buildProductionWhere(ProductionStage.LOOMS, filters, companyId);
    const whereSql = `WHERE ${conditions.map((c) => `pr.${c}`).join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<LoomsQueryRow>(
            `${LOOMS_SELECT_SQL} ${whereSql}
             ORDER BY pr.production_date DESC, pr.created_at DESC
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM production_records pr ${whereSql}`, values);
        const ids = rowsResult.rows.map((r) => r.id);
        const wastageMap = await findWastagesByProductionRecordIds(ids);
        return {
            rows: rowsResult.rows.map((row) => toLoomsRow(row, wastageMap.get(row.id) ?? [])),
            total: Number(countResult.rows[0]?.count ?? 0),
        };
    });
}

export interface LoomsExistingRow {
    id: string;
    isApproved: boolean;
    colorId: string;
    sizeId: string;
    yarnInputKg: number;
}

export async function findLoomsExisting(id: string, companyId: string): Promise<LoomsExistingRow | null> {
    return queryOne<LoomsExistingRow>(
        `SELECT pr.id, pr.is_approved AS "isApproved", pr.color_id AS "colorId", pr.size_id AS "sizeId", ld.yarn_input_kg AS "yarnInputKg"
         FROM production_records pr
         JOIN loom_details ld ON ld.production_record_id = pr.id
         WHERE pr.id = $1 AND pr.company_id = $2 AND pr.stage = $3`,
        [id, companyId, ProductionStage.LOOMS],
    );
}

/**
 * Cumulative, all-time yarn available for Looms to consume for a colour+size variant — total
 * Extruder yarnOutputKg ever recorded for it, minus total Looms yarnInputKg already consumed.
 * Backs GET /production/looms/available and the create/update guard (YARN_INPUT_EXCEEDS_AVAILABLE).
 * `excludeRecordId` omits a record's own existing yarnInputKg from the "already consumed" side.
 * Runs on `client` when passed (inside the caller's transaction) or the shared pool otherwise.
 */
export async function getAvailableYarnKgForVariant(
    companyId: string,
    colorId: string,
    sizeId: string,
    client?: pg.PoolClient,
    excludeRecordId?: string,
): Promise<number> {
    const extruderResult = await query<{ total: number | null }>(
        `SELECT SUM(ed.yarn_output_kg) AS total
         FROM production_records pr
         JOIN extruder_details ed ON ed.production_record_id = pr.id
         WHERE pr.company_id = $1 AND pr.stage = $2 AND pr.color_id = $3 AND pr.size_id = $4`,
        [companyId, ProductionStage.EXTRUDER, colorId, sizeId],
        client,
    );
    const loomResult = await query<{ total: number | null }>(
        `SELECT SUM(ld.yarn_input_kg) AS total
         FROM production_records pr
         JOIN loom_details ld ON ld.production_record_id = pr.id
         WHERE pr.company_id = $1 AND pr.stage = $2 AND pr.color_id = $3 AND pr.size_id = $4
         ${excludeRecordId ? 'AND pr.id <> $5' : ''}`,
        excludeRecordId ? [companyId, ProductionStage.LOOMS, colorId, sizeId, excludeRecordId] : [companyId, ProductionStage.LOOMS, colorId, sizeId],
        client,
    );
    const extruderTotal = extruderResult.rows[0]?.total ?? 0;
    const loomTotal = loomResult.rows[0]?.total ?? 0;
    return extruderTotal - loomTotal;
}

export interface UpdateLoomsHeaderPatch {
    productionDate?: Date;
    colorId?: string;
    sizeId?: string;
    remarks?: string;
    actor: string;
}

export async function updateLoomsHeader(client: pg.PoolClient, id: string, patch: UpdateLoomsHeaderPatch): Promise<void> {
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

export interface UpdateLoomsDetailPatch {
    yarnInputKg?: number;
    fabricOutputKg?: number;
}

export async function updateLoomsDetail(client: pg.PoolClient, productionRecordId: string, patch: UpdateLoomsDetailPatch): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (patch.yarnInputKg !== undefined) {
        values.push(patch.yarnInputKg);
        sets.push(`yarn_input_kg = $${values.length}`);
    }
    if (patch.fabricOutputKg !== undefined) {
        values.push(patch.fabricOutputKg);
        sets.push(`fabric_output_kg = $${values.length}`);
    }
    if (sets.length === 0) return;
    values.push(productionRecordId);
    await client.query(`UPDATE loom_details SET ${sets.join(', ')} WHERE production_record_id = $${values.length}`, values);
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

export interface LoomsSummaryRow {
    colorId: string | null;
    colorName: string | null;
    fabricOutputKg: number | null;
}

export async function findLoomsRowsForSummary(companyId: string, dateFrom: Date, dateTo: Date): Promise<LoomsSummaryRow[]> {
    const result = await query<LoomsSummaryRow>(
        `SELECT c.id AS "colorId", c.name AS "colorName", ld.fabric_output_kg AS "fabricOutputKg"
         FROM production_records pr
         LEFT JOIN colors c ON c.id = pr.color_id
         LEFT JOIN loom_details ld ON ld.production_record_id = pr.id
         WHERE pr.company_id = $1 AND pr.stage = $2 AND pr.production_date >= $3 AND pr.production_date <= $4`,
        [companyId, ProductionStage.LOOMS, dateFrom, dateTo],
    );
    return result.rows;
}
