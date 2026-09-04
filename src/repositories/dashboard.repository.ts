import { query } from '../db/query.js';
import { ProductionStage, ProductionType } from '../types/enums.js';

export interface StageProductionRow {
    productionDate: Date;
    isApproved: boolean;
    inputKg: number | null;
    outputKg: number | null;
}

// This dashboard is the real Production Details dashboard only — Sample Production has its own
// client-side aggregation (see sample-production-page.tsx) — so every query here is hardcoded to
// type = 'PRODUCTION', not a caller-supplied filter, to keep Sample entries out unconditionally.

export async function findExtruderRowsForDashboard(companyId: string, dateFrom: Date, dateTo: Date): Promise<StageProductionRow[]> {
    const result = await query<StageProductionRow>(
        `SELECT pr.production_date AS "productionDate", pr.is_approved AS "isApproved",
                ed.raw_material_kg AS "inputKg", ed.yarn_output_kg AS "outputKg"
         FROM production_records pr
         JOIN extruder_details ed ON ed.production_record_id = pr.id
         WHERE pr.company_id = $1 AND pr.stage = $2 AND pr.type = $5 AND pr.production_date >= $3 AND pr.production_date <= $4`,
        [companyId, ProductionStage.EXTRUDER, dateFrom, dateTo, ProductionType.PRODUCTION],
    );
    return result.rows;
}

export async function findLoomsRowsForDashboard(companyId: string, dateFrom: Date, dateTo: Date): Promise<StageProductionRow[]> {
    const result = await query<StageProductionRow>(
        `SELECT pr.production_date AS "productionDate", pr.is_approved AS "isApproved",
                ld.yarn_input_kg AS "inputKg", ld.fabric_output_kg AS "outputKg"
         FROM production_records pr
         JOIN loom_details ld ON ld.production_record_id = pr.id
         WHERE pr.company_id = $1 AND pr.stage = $2 AND pr.type = $5 AND pr.production_date >= $3 AND pr.production_date <= $4`,
        [companyId, ProductionStage.LOOMS, dateFrom, dateTo, ProductionType.PRODUCTION],
    );
    return result.rows;
}

export async function findFabricRowsForDashboard(companyId: string, dateFrom: Date, dateTo: Date): Promise<StageProductionRow[]> {
    const result = await query<StageProductionRow>(
        `SELECT pr.production_date AS "productionDate", pr.is_approved AS "isApproved",
                fcd.fabric_input_kg AS "inputKg", fcd.output_kg AS "outputKg"
         FROM production_records pr
         JOIN fabric_check_details fcd ON fcd.production_record_id = pr.id
         WHERE pr.company_id = $1 AND pr.stage = $2 AND pr.type = $5 AND pr.production_date >= $3 AND pr.production_date <= $4`,
        [companyId, ProductionStage.FABRIC_CHECKING, dateFrom, dateTo, ProductionType.PRODUCTION],
    );
    return result.rows;
}

export interface DashboardWastageRow {
    quantityKg: number;
    wastageTypeCode: string;
    productionDate: Date;
    stage: string;
}

export async function findWastageRowsForDashboard(companyId: string, dateFrom: Date, dateTo: Date): Promise<DashboardWastageRow[]> {
    const result = await query<DashboardWastageRow>(
        `SELECT wr.quantity_kg AS "quantityKg", wt.code AS "wastageTypeCode", pr.production_date AS "productionDate", pr.stage
         FROM wastage_records wr
         JOIN wastage_types wt ON wt.id = wr.wastage_type_id
         JOIN production_records pr ON pr.id = wr.production_record_id
         WHERE wr.company_id = $1 AND pr.production_date >= $2 AND pr.production_date <= $3
           AND pr.stage = ANY($4::"ProductionStage"[]) AND pr.type = $5`,
        [companyId, dateFrom, dateTo, [ProductionStage.EXTRUDER, ProductionStage.LOOMS, ProductionStage.FABRIC_CHECKING], ProductionType.PRODUCTION],
    );
    return result.rows;
}
