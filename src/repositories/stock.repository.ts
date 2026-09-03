import { query } from '../db/query.js';
import { ProductionStage } from '../types/enums.js';

export interface NamedItemRow {
    id: string;
    name: string;
}

export async function findBrandsChemicalsColors(companyId: string): Promise<{
    brands: NamedItemRow[];
    chemicals: NamedItemRow[];
    colors: NamedItemRow[];
}> {
    const [brands, chemicals, colors] = await Promise.all([
        query<NamedItemRow>('SELECT id, name FROM brands WHERE company_id = $1 ORDER BY name ASC', [companyId]),
        query<NamedItemRow>('SELECT id, name FROM chemicals WHERE company_id = $1 ORDER BY name ASC', [companyId]),
        query<NamedItemRow>('SELECT id, name FROM colors WHERE company_id = $1 ORDER BY name ASC', [companyId]),
    ]);
    return { brands: brands.rows, chemicals: chemicals.rows, colors: colors.rows };
}

export interface StockInventoryRow {
    type: string;
    weightKg: number;
    brandId: string | null;
    chemicalId: string | null;
    colorId: string | null;
}

export async function findInventoryRowsForStock(companyId: string): Promise<StockInventoryRow[]> {
    const result = await query<StockInventoryRow>(
        'SELECT type, weight_kg AS "weightKg", brand_id AS "brandId", chemical_id AS "chemicalId", color_id AS "colorId" FROM inventory WHERE company_id = $1',
        [companyId],
    );
    return result.rows;
}

export interface StockExtruderRow {
    brandId: string;
    rawMaterialKg: number;
    chemicalId: string;
    chemicalKg: number;
    colorConsumedKg: number;
    colorId: string;
}

export async function findExtruderRowsForStock(companyId: string): Promise<StockExtruderRow[]> {
    const result = await query<StockExtruderRow>(
        `SELECT ed.brand_id AS "brandId", ed.raw_material_kg AS "rawMaterialKg", ed.chemical_id AS "chemicalId",
                ed.chemical_kg AS "chemicalKg", ed.color_consumed_kg AS "colorConsumedKg", pr.color_id AS "colorId"
         FROM extruder_details ed
         JOIN production_records pr ON pr.id = ed.production_record_id
         WHERE pr.company_id = $1 AND pr.stage = $2`,
        [companyId, ProductionStage.EXTRUDER],
    );
    return result.rows;
}
