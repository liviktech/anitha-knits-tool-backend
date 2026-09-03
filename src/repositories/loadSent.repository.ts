import { query, queryOne } from '../db/query.js';
import { withReadClient } from '../db/transaction.js';
import { buildProductionWhere, type ProductionListFilters } from '../utils/productionFilters.js';
import { ProductionStage } from '../types/enums.js';

export interface LoadSentRecordRow {
    id: string;
    stage: string;
    productionDate: Date;
    remarks: string | null;
    color: { id: string; name: string };
    size: { id: string; name: string };
    loadSent: {
        fabricWeight: number;
        fwWeight: number;
        bwWeight: number;
        totalWastageWeight: number;
        driverName: string | null;
        vehicleNo: string | null;
    } | null;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

interface LoadSentQueryRow {
    id: string;
    stage: string;
    productionDate: Date;
    remarks: string | null;
    colorId: string;
    colorName: string;
    sizeId: string;
    sizeName: string;
    fabricWeight: number | null;
    fwWeight: number | null;
    bwWeight: number | null;
    totalWastageWeight: number | null;
    driverName: string | null;
    vehicleNo: string | null;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string | null;
}

const LOAD_SENT_SELECT_SQL = `
    SELECT pr.id, pr.stage, pr.production_date AS "productionDate", pr.remarks,
           c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName",
           ls.fabric_weight AS "fabricWeight", ls.fw_weight AS "fwWeight", ls.bw_weight AS "bwWeight",
           ls.total_wastage_weight AS "totalWastageWeight", ls.driver_name AS "driverName", ls.vehicle_no AS "vehicleNo",
           pr.created_at AS "createdAt", pr.created_by AS "createdBy", pr.updated_at AS "updatedAt", pr.updated_by AS "updatedBy"
    FROM production_records pr
    JOIN colors c ON c.id = pr.color_id
    JOIN sizes s ON s.id = pr.size_id
    JOIN load_sent ls ON ls.production_record_id = pr.id
`;

function toLoadSentRow(row: LoadSentQueryRow): LoadSentRecordRow {
    return {
        id: row.id,
        stage: row.stage,
        productionDate: row.productionDate,
        remarks: row.remarks,
        color: { id: row.colorId, name: row.colorName },
        size: { id: row.sizeId, name: row.sizeName },
        loadSent:
            row.fabricWeight !== null
                ? {
                      fabricWeight: row.fabricWeight,
                      fwWeight: row.fwWeight!,
                      bwWeight: row.bwWeight!,
                      totalWastageWeight: row.totalWastageWeight!,
                      driverName: row.driverName,
                      vehicleNo: row.vehicleNo,
                  }
                : null,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
    };
}

export interface CreateLoadSentInputRow {
    companyId: string;
    productionDate: Date;
    colorId: string;
    sizeId: string;
    actor: string;
    fabricWeight?: number;
    driverName?: string | null;
    vehicleNo?: string | null;
}

export async function createLoadSent(input: CreateLoadSentInputRow): Promise<LoadSentRecordRow> {
    const row = await queryOne<LoadSentQueryRow>(
        `WITH pr AS (
            INSERT INTO production_records (id, company_id, stage, production_date, color_id, size_id, created_by, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())
            RETURNING id, company_id, stage, production_date, color_id, size_id, remarks, created_at, created_by, updated_at, updated_by
         ), ls AS (
            INSERT INTO load_sent (id, company_id, production_record_id, color_id, size_id, fabric_weight, driver_name, vehicle_no, created_by, updated_at)
            SELECT gen_random_uuid(), $1, pr.id, $4, $5, $7, $8, $9, $6, now() FROM pr
            RETURNING production_record_id, fabric_weight, fw_weight, bw_weight, total_wastage_weight, driver_name, vehicle_no
         )
         SELECT pr.id, pr.stage, pr.production_date AS "productionDate", pr.remarks,
                c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName",
                ls.fabric_weight AS "fabricWeight", ls.fw_weight AS "fwWeight", ls.bw_weight AS "bwWeight",
                ls.total_wastage_weight AS "totalWastageWeight", ls.driver_name AS "driverName", ls.vehicle_no AS "vehicleNo",
                pr.created_at AS "createdAt", pr.created_by AS "createdBy", pr.updated_at AS "updatedAt", pr.updated_by AS "updatedBy"
         FROM pr
         JOIN ls ON ls.production_record_id = pr.id
         JOIN colors c ON c.id = pr.color_id
         JOIN sizes s ON s.id = pr.size_id`,
        [
            input.companyId,
            ProductionStage.DELIVERY,
            input.productionDate,
            input.colorId,
            input.sizeId,
            input.actor,
            input.fabricWeight ?? 0,
            input.driverName ?? null,
            input.vehicleNo ?? null,
        ],
    );
    if (!row) throw new Error('Insert into production_records/load_sent returned no row');
    return toLoadSentRow(row);
}

export async function listLoadSent(
    filters: ProductionListFilters,
    companyId: string,
    skip: number,
    take: number,
): Promise<{ rows: LoadSentRecordRow[]; total: number }> {
    const { conditions, values } = buildProductionWhere(ProductionStage.DELIVERY, filters, companyId);
    const whereSql = `WHERE ${conditions.map((c) => `pr.${c}`).join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<LoadSentQueryRow>(
            `${LOAD_SENT_SELECT_SQL} ${whereSql}
             ORDER BY pr.production_date DESC, pr.created_at DESC
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM production_records pr JOIN load_sent ls ON ls.production_record_id = pr.id ${whereSql}`,
            values,
        );
        return { rows: rowsResult.rows.map(toLoadSentRow), total: Number(countResult.rows[0]?.count ?? 0) };
    });
}

export async function getLoadSentById(id: string, companyId: string): Promise<LoadSentRecordRow | null> {
    const result = await query<LoadSentQueryRow>(`${LOAD_SENT_SELECT_SQL} WHERE pr.id = $1 AND pr.company_id = $2 AND pr.stage = $3`, [
        id,
        companyId,
        ProductionStage.DELIVERY,
    ]);
    const row = result.rows[0];
    return row ? toLoadSentRow(row) : null;
}

export interface LoadSentExistingRow {
    id: string;
    productionDate: Date;
    colorId: string;
    sizeId: string;
    fabricWeight: number;
    fwWeight: number;
    bwWeight: number;
    driverName: string | null;
    vehicleNo: string | null;
}

export async function findLoadSentExisting(id: string, companyId: string): Promise<LoadSentExistingRow | null> {
    return queryOne<LoadSentExistingRow>(
        `SELECT pr.id, pr.production_date AS "productionDate", pr.color_id AS "colorId", pr.size_id AS "sizeId",
                ls.fabric_weight AS "fabricWeight", ls.fw_weight AS "fwWeight", ls.bw_weight AS "bwWeight",
                ls.driver_name AS "driverName", ls.vehicle_no AS "vehicleNo"
         FROM production_records pr
         JOIN load_sent ls ON ls.production_record_id = pr.id
         WHERE pr.id = $1 AND pr.company_id = $2 AND pr.stage = $3`,
        [id, companyId, ProductionStage.DELIVERY],
    );
}

export interface UpdateLoadSentInputRow {
    productionDate?: Date;
    colorId?: string;
    sizeId?: string;
    actor: string;
    fabricWeight: number;
    fwWeight: number;
    bwWeight: number;
    totalWastageWeight: number;
    driverName: string | null;
    vehicleNo: string | null;
}

export async function updateLoadSent(id: string, input: UpdateLoadSentInputRow): Promise<LoadSentRecordRow> {
    // ls params occupy $1-$7 (fixed, always set); pr params are appended after, so their
    // placeholders are computed from the running `values.length`, not a separate local count.
    const values: unknown[] = [
        input.fabricWeight,
        input.fwWeight,
        input.bwWeight,
        input.totalWastageWeight,
        input.driverName,
        input.vehicleNo,
        input.actor,
    ];

    const prSets: string[] = [];
    if (input.productionDate !== undefined) {
        values.push(input.productionDate);
        prSets.push(`production_date = $${values.length}`);
    }
    if (input.colorId !== undefined) {
        values.push(input.colorId);
        prSets.push(`color_id = $${values.length}`);
    }
    if (input.sizeId !== undefined) {
        values.push(input.sizeId);
        prSets.push(`size_id = $${values.length}`);
    }
    values.push(input.actor);
    prSets.push(`updated_by = $${values.length}`);
    values.push(id);
    const idPlaceholder = `$${values.length}`;

    const row = await queryOne<LoadSentQueryRow>(
        `WITH pr AS (
            UPDATE production_records SET ${prSets.join(', ')}, updated_at = now()
            WHERE id = ${idPlaceholder}
            RETURNING id, color_id, size_id
         ), ls AS (
            UPDATE load_sent SET fabric_weight = $1, fw_weight = $2, bw_weight = $3, total_wastage_weight = $4,
                   driver_name = $5, vehicle_no = $6, updated_by = $7, updated_at = now()
            WHERE production_record_id = (SELECT id FROM pr)
            RETURNING production_record_id, fabric_weight, fw_weight, bw_weight, total_wastage_weight, driver_name, vehicle_no
         )
         SELECT p.id, p.stage, p.production_date AS "productionDate", p.remarks,
                c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName",
                ls.fabric_weight AS "fabricWeight", ls.fw_weight AS "fwWeight", ls.bw_weight AS "bwWeight",
                ls.total_wastage_weight AS "totalWastageWeight", ls.driver_name AS "driverName", ls.vehicle_no AS "vehicleNo",
                p.created_at AS "createdAt", p.created_by AS "createdBy", p.updated_at AS "updatedAt", p.updated_by AS "updatedBy"
         FROM production_records p
         JOIN ls ON ls.production_record_id = p.id
         JOIN colors c ON c.id = p.color_id
         JOIN sizes s ON s.id = p.size_id
         WHERE p.id = ${idPlaceholder}`,
        values,
    );
    if (!row) throw new Error(`Update on production_records/load_sent returned no row for id ${id}`);
    return toLoadSentRow(row);
}

/** LoadSent has onDelete: Cascade on production_record_id, so deleting the ProductionRecord alone removes it — no explicit child cleanup needed. */
export async function deleteLoadSent(id: string): Promise<void> {
    await query('DELETE FROM production_records WHERE id = $1', [id]);
}

export interface LoadSentSummaryRow {
    id: string;
    colorId: string;
    colorName: string;
    sizeId: string;
    sizeName: string;
    productionDate: Date;
    fabricWeight: number;
    fwWeight: number;
    bwWeight: number;
    totalWastageWeight: number;
}

export async function findLoadSentRowsForSummary(companyId: string, dateFrom: Date, dateTo: Date): Promise<LoadSentSummaryRow[]> {
    const result = await query<LoadSentSummaryRow>(
        `SELECT pr.id, c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName", pr.production_date AS "productionDate",
                ls.fabric_weight AS "fabricWeight", ls.fw_weight AS "fwWeight", ls.bw_weight AS "bwWeight", ls.total_wastage_weight AS "totalWastageWeight"
         FROM production_records pr
         JOIN colors c ON c.id = pr.color_id
         JOIN sizes s ON s.id = pr.size_id
         JOIN load_sent ls ON ls.production_record_id = pr.id
         WHERE pr.company_id = $1 AND pr.stage = $2 AND pr.production_date >= $3 AND pr.production_date <= $4
         ORDER BY pr.production_date DESC, pr.created_at DESC`,
        [companyId, ProductionStage.DELIVERY, dateFrom, dateTo],
    );
    return result.rows;
}

export interface StockFabricCheckingRow {
    colorId: string;
    colorName: string;
    sizeId: string;
    sizeName: string;
    outputKg: number | null;
}

export async function findFabricCheckingRowsForStock(companyId: string): Promise<StockFabricCheckingRow[]> {
    const result = await query<StockFabricCheckingRow>(
        `SELECT c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName", fcd.output_kg AS "outputKg"
         FROM production_records pr
         JOIN colors c ON c.id = pr.color_id
         JOIN sizes s ON s.id = pr.size_id
         LEFT JOIN fabric_check_details fcd ON fcd.production_record_id = pr.id
         WHERE pr.company_id = $1 AND pr.stage = $2`,
        [companyId, ProductionStage.FABRIC_CHECKING],
    );
    return result.rows;
}

export interface StockWastageRow {
    colorId: string;
    colorName: string;
    sizeId: string;
    sizeName: string;
    quantityKg: number;
    wastageTypeCode: string;
}

export async function findWastageRowsForStock(companyId: string): Promise<StockWastageRow[]> {
    const result = await query<StockWastageRow>(
        `SELECT c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName",
                wr.quantity_kg AS "quantityKg", wt.code AS "wastageTypeCode"
         FROM wastage_records wr
         JOIN wastage_types wt ON wt.id = wr.wastage_type_id
         JOIN production_records pr ON pr.id = wr.production_record_id
         JOIN colors c ON c.id = pr.color_id
         JOIN sizes s ON s.id = pr.size_id
         WHERE wr.company_id = $1 AND pr.stage = $2`,
        [companyId, ProductionStage.FABRIC_CHECKING],
    );
    return result.rows;
}

export interface StockLoadSentRow {
    colorId: string;
    colorName: string;
    sizeId: string;
    sizeName: string;
    fabricWeight: number;
    fwWeight: number;
    bwWeight: number;
}

export async function findLoadSentRowsForStock(companyId: string): Promise<StockLoadSentRow[]> {
    const result = await query<StockLoadSentRow>(
        `SELECT c.id AS "colorId", c.name AS "colorName", s.id AS "sizeId", s.name AS "sizeName",
                ls.fabric_weight AS "fabricWeight", ls.fw_weight AS "fwWeight", ls.bw_weight AS "bwWeight"
         FROM load_sent ls
         JOIN colors c ON c.id = ls.color_id
         JOIN sizes s ON s.id = ls.size_id
         WHERE ls.company_id = $1`,
        [companyId],
    );
    return result.rows;
}
