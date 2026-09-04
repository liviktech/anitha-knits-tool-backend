import type pg from 'pg';
import { query, queryOne } from '../db/query.js';
import { withReadClient } from '../db/transaction.js';
import { findWastagesByProductionRecordId, findWastagesByProductionRecordIds, type WastageRow } from './wastage.repository.js';
import type { ProductionListFilters } from '../utils/productionFilters.js';
import { buildProductionWhere } from '../utils/productionFilters.js';
import { ProductionStage } from '../types/enums.js';
import { formatDateOnly } from '../utils/dateOnly.js';

export interface FabricCheckingRecordRow {
    id: string;
    stage: string;
    productionDate: string;
    remarks: string | null;
    color: { id: string; name: string };
    size: { id: string; name: string };
    chemical: { id: string; name: string } | null;
    fabricCheck: { fabricInputKg: number; outputKg: number | null } | null;
    wastages: WastageRow[];
    isApproved: boolean;
    approvedAt: Date | null;
    approvedBy: string | null;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

interface FabricCheckingQueryRow {
    id: string;
    stage: string;
    productionDate: Date;
    remarks: string | null;
    colorId: string;
    colorName: string;
    sizeId: string;
    sizeName: string;
    fabricInputKg: number | null;
    outputKg: number | null;
    chemicalId: string | null;
    chemicalName: string | null;
    isApproved: boolean;
    approvedAt: Date | null;
    approvedBy: string | null;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

const FABRIC_CHECKING_SELECT_SQL = `
    SELECT pr.id, pr.stage, pr.production_date AS "productionDate", pr.remarks,
           c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName",
           fcd.fabric_input_kg AS "fabricInputKg", fcd.output_kg AS "outputKg",
           fcd.chemical_id AS "chemicalId", ch.name AS "chemicalName",
           pr.is_approved AS "isApproved", pr.approved_at AS "approvedAt", pr.approved_by AS "approvedBy",
           pr.created_at AS "createdAt", pr.created_by AS "createdBy", pr.updated_at AS "updatedAt", pr.updated_by AS "updatedBy"
    FROM production_records pr
    JOIN colors c ON c.id = pr.color_id
    JOIN sizes s ON s.id = pr.size_id
    LEFT JOIN fabric_check_details fcd ON fcd.production_record_id = pr.id
    LEFT JOIN chemicals ch ON ch.id = fcd.chemical_id
`;

function toFabricCheckingRow(row: FabricCheckingQueryRow, wastages: WastageRow[]): FabricCheckingRecordRow {
    return {
        id: row.id,
        stage: row.stage,
        productionDate: formatDateOnly(row.productionDate),
        remarks: row.remarks,
        color: { id: row.colorId, name: row.colorName },
        size: { id: row.sizeId, name: row.sizeName },
        chemical: row.chemicalId ? { id: row.chemicalId, name: row.chemicalName! } : null,
        fabricCheck: row.fabricInputKg !== null ? { fabricInputKg: row.fabricInputKg, outputKg: row.outputKg } : null,
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

export interface CreateFabricCheckingInputRow {
    companyId: string;
    productionDate: Date;
    colorId: string;
    sizeId: string;
    chemicalId: string;
    remarks?: string | null;
    actor: string;
    fabricInputKg: number;
    outputKg?: number | null;
}

export async function insertFabricCheckingProduction(client: pg.PoolClient, input: CreateFabricCheckingInputRow): Promise<string> {
    const prResult = await client.query<{ id: string }>(
        `INSERT INTO production_records (id, company_id, stage, production_date, color_id, size_id, remarks, created_by, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, now())
         RETURNING id`,
        [input.companyId, ProductionStage.FABRIC_CHECKING, input.productionDate, input.colorId, input.sizeId, input.remarks ?? null, input.actor],
    );
    const productionRecordId = prResult.rows[0]!.id;

    await client.query(
        `INSERT INTO fabric_check_details (id, production_record_id, fabric_input_kg, output_kg, chemical_id)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
        [productionRecordId, input.fabricInputKg, input.outputKg ?? null, input.chemicalId],
    );

    return productionRecordId;
}

/** Latest Loom batch's fabric_output_kg for this (companyId, colorId, sizeId), null if none exists yet. Must run on the caller's transaction client so it sees any just-created Loom row. */
export async function findLatestLoomFabricOutput(client: pg.PoolClient, companyId: string, colorId: string, sizeId: string): Promise<number | null> {
    const result = await client.query<{ fabricOutputKg: number }>(
        `SELECT ld.fabric_output_kg AS "fabricOutputKg"
         FROM production_records pr
         JOIN loom_details ld ON ld.production_record_id = pr.id
         WHERE pr.company_id = $1 AND pr.stage = $2 AND pr.color_id = $3 AND pr.size_id = $4
         ORDER BY pr.production_date DESC, pr.created_at DESC
         LIMIT 1`,
        [companyId, ProductionStage.LOOMS, colorId, sizeId],
    );
    return result.rows[0]?.fabricOutputKg ?? null;
}

export async function findFabricCheckingProductionByIdTx(client: pg.PoolClient, id: string): Promise<FabricCheckingRecordRow> {
    const result = await client.query<FabricCheckingQueryRow>(`${FABRIC_CHECKING_SELECT_SQL} WHERE pr.id = $1 AND pr.stage = $2`, [
        id,
        ProductionStage.FABRIC_CHECKING,
    ]);
    const row = result.rows[0];
    if (!row) throw new Error(`production_records ${id} not found after write`);
    const wastages = await findWastagesByProductionRecordId(id, client);
    return toFabricCheckingRow(row, wastages);
}

export async function getFabricCheckingProductionById(id: string, companyId: string): Promise<FabricCheckingRecordRow | null> {
    const result = await query<FabricCheckingQueryRow>(`${FABRIC_CHECKING_SELECT_SQL} WHERE pr.id = $1 AND pr.company_id = $2 AND pr.stage = $3`, [
        id,
        companyId,
        ProductionStage.FABRIC_CHECKING,
    ]);
    const row = result.rows[0];
    if (!row) return null;
    const wastages = await findWastagesByProductionRecordId(id);
    return toFabricCheckingRow(row, wastages);
}

export async function listFabricCheckingProductions(
    filters: ProductionListFilters,
    companyId: string,
    skip: number,
    take: number,
): Promise<{ rows: FabricCheckingRecordRow[]; total: number }> {
    const { conditions, values } = buildProductionWhere(ProductionStage.FABRIC_CHECKING, filters, companyId);
    const whereSql = `WHERE ${conditions.map((c) => `pr.${c}`).join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<FabricCheckingQueryRow>(
            `${FABRIC_CHECKING_SELECT_SQL} ${whereSql}
             ORDER BY pr.production_date DESC, pr.created_at DESC
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM production_records pr ${whereSql}`, values);
        const ids = rowsResult.rows.map((r) => r.id);
        const wastageMap = await findWastagesByProductionRecordIds(ids);
        return {
            rows: rowsResult.rows.map((row) => toFabricCheckingRow(row, wastageMap.get(row.id) ?? [])),
            total: Number(countResult.rows[0]?.count ?? 0),
        };
    });
}

export interface FabricCheckingExistingRow {
    id: string;
    isApproved: boolean;
    colorId: string;
    sizeId: string;
    chemicalId: string;
    productionDate: Date;
    fabricInputKg: number;
}

export async function findFabricCheckingExisting(id: string, companyId: string): Promise<FabricCheckingExistingRow | null> {
    return queryOne<FabricCheckingExistingRow>(
        `SELECT pr.id, pr.is_approved AS "isApproved", pr.color_id AS "colorId", pr.size_id AS "sizeId",
                fcd.chemical_id AS "chemicalId", pr.production_date AS "productionDate", fcd.fabric_input_kg AS "fabricInputKg"
         FROM production_records pr
         JOIN fabric_check_details fcd ON fcd.production_record_id = pr.id
         WHERE pr.id = $1 AND pr.company_id = $2 AND pr.stage = $3`,
        [id, companyId, ProductionStage.FABRIC_CHECKING],
    );
}

/**
 * Fabric available to check for a colour+size+chemical variant on one specific production date —
 * that day's Looms fabricOutputKg (summed, in case of multiple Looms rows that day), minus
 * that same day's Fabric Checking fabricInputKg already recorded against it (also summed), both
 * scoped to the same chemical (mirroring the colour+size scoping). Deliberately scoped to a
 * single day, not cumulative across all history — each day's Looms batch is checked against
 * that day's own output only. Backs GET /fabric-checking/available and the create/update guard
 * (FABRIC_INPUT_EXCEEDS_AVAILABLE), so the UI can't disagree with the server about what's
 * allowed. `excludeRecordId` omits a record's own existing fabricInputKg from the "already
 * consumed" side, so re-validating an update against its own prior value isn't a false
 * rejection. Runs on `client` when passed (inside the caller's transaction, so it can see any
 * just-created Loom row) or the shared pool otherwise.
 */
export async function getAvailableFabricKgForVariant(
    companyId: string,
    colorId: string,
    sizeId: string,
    chemicalId: string,
    productionDate: Date,
    client?: pg.PoolClient,
    excludeRecordId?: string,
): Promise<number> {
    const loomResult = await query<{ total: number | null }>(
        `SELECT SUM(ld.fabric_output_kg) AS total
         FROM production_records pr
         JOIN loom_details ld ON ld.production_record_id = pr.id
         WHERE pr.company_id = $1 AND pr.stage = $2 AND pr.color_id = $3 AND pr.size_id = $4 AND pr.production_date = $5 AND ld.chemical_id = $6`,
        [companyId, ProductionStage.LOOMS, colorId, sizeId, productionDate, chemicalId],
        client,
    );
    const checkResult = await query<{ total: number | null }>(
        `SELECT SUM(fcd.fabric_input_kg) AS total
         FROM production_records pr
         JOIN fabric_check_details fcd ON fcd.production_record_id = pr.id
         WHERE pr.company_id = $1 AND pr.stage = $2 AND pr.color_id = $3 AND pr.size_id = $4 AND pr.production_date = $5 AND fcd.chemical_id = $6
         ${excludeRecordId ? 'AND pr.id <> $7' : ''}`,
        excludeRecordId
            ? [companyId, ProductionStage.FABRIC_CHECKING, colorId, sizeId, productionDate, chemicalId, excludeRecordId]
            : [companyId, ProductionStage.FABRIC_CHECKING, colorId, sizeId, productionDate, chemicalId],
        client,
    );
    const loomTotal = loomResult.rows[0]?.total ?? 0;
    const checkTotal = checkResult.rows[0]?.total ?? 0;
    return loomTotal - checkTotal;
}

export interface UpdateFabricCheckingHeaderPatch {
    productionDate?: Date;
    colorId?: string;
    sizeId?: string;
    remarks?: string;
    actor: string;
}

export async function updateFabricCheckingHeader(client: pg.PoolClient, id: string, patch: UpdateFabricCheckingHeaderPatch): Promise<void> {
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

export interface UpdateFabricCheckingDetailPatch {
    fabricInputKg?: number;
    outputKg?: number | null;
    chemicalId?: string;
}

export async function updateFabricCheckingDetail(client: pg.PoolClient, productionRecordId: string, patch: UpdateFabricCheckingDetailPatch): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (patch.fabricInputKg !== undefined) {
        values.push(patch.fabricInputKg);
        sets.push(`fabric_input_kg = $${values.length}`);
    }
    if (patch.outputKg !== undefined) {
        values.push(patch.outputKg);
        sets.push(`output_kg = $${values.length}`);
    }
    if (patch.chemicalId !== undefined) {
        values.push(patch.chemicalId);
        sets.push(`chemical_id = $${values.length}`);
    }
    if (sets.length === 0) return;
    values.push(productionRecordId);
    await client.query(`UPDATE fabric_check_details SET ${sets.join(', ')} WHERE production_record_id = $${values.length}`, values);
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

export interface FabricCheckingSummaryRow {
    id: string;
    colorId: string | null;
    colorName: string | null;
    sizeId: string | null;
    sizeName: string | null;
    fabricInputKg: number | null;
    outputKg: number | null;
}

export async function findFabricCheckingRowsForSummary(companyId: string, dateFrom: Date, dateTo: Date): Promise<FabricCheckingSummaryRow[]> {
    const result = await query<FabricCheckingSummaryRow>(
        `SELECT pr.id, c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName",
                fcd.fabric_input_kg AS "fabricInputKg", fcd.output_kg AS "outputKg"
         FROM production_records pr
         LEFT JOIN colors c ON c.id = pr.color_id
         LEFT JOIN sizes s ON s.id = pr.size_id
         LEFT JOIN fabric_check_details fcd ON fcd.production_record_id = pr.id
         WHERE pr.company_id = $1 AND pr.stage = $2 AND pr.production_date >= $3 AND pr.production_date <= $4`,
        [companyId, ProductionStage.FABRIC_CHECKING, dateFrom, dateTo],
    );
    return result.rows;
}

export interface FabricCheckingWastageRow {
    productionRecordId: string;
    quantityKg: number;
    wastageTypeCode: string;
}

export async function findFabricCheckingWastagesForSummary(companyId: string, dateFrom: Date, dateTo: Date): Promise<FabricCheckingWastageRow[]> {
    const result = await query<FabricCheckingWastageRow>(
        `SELECT wr.production_record_id AS "productionRecordId", wr.quantity_kg AS "quantityKg", wt.code AS "wastageTypeCode"
         FROM wastage_records wr
         JOIN wastage_types wt ON wt.id = wr.wastage_type_id
         JOIN production_records pr ON pr.id = wr.production_record_id
         WHERE pr.company_id = $1 AND pr.stage = $2 AND pr.production_date >= $3 AND pr.production_date <= $4`,
        [companyId, ProductionStage.FABRIC_CHECKING, dateFrom, dateTo],
    );
    return result.rows;
}
