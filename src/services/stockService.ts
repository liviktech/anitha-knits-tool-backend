import { InventoryType } from '../types/enums.js';
import { findBrandsChemicalsColors, findExtruderRowsForStock, findInventoryRowsForStock, type NamedItemRow } from '../repositories/stock.repository.js';

function roundKg(value: number): number {
    return Math.round(value * 1000) / 1000;
}

type StockRow = { id: string; name: string; intakeKg: number; consumedKg: number; stockKg: number };

function toStockRows(items: NamedItemRow[], intakeById: Map<string, number>, consumedById: Map<string, number>): StockRow[] {
    return items.map((item) => {
        const intakeKg = roundKg(intakeById.get(item.id) ?? 0);
        const consumedKg = roundKg(consumedById.get(item.id) ?? 0);
        return { id: item.id, name: item.name, intakeKg, consumedKg, stockKg: roundKg(intakeKg - consumedKg) };
    });
}

/**
 * Stock on hand per raw-material brand / chemical / colour: current inventory
 * balance (intake) minus what's been drawn down by extruder production.
 * Covers every brand/chemical/colour on file for the company, not just the
 * ones with an inventory row, so a never-stocked-but-already-consumed item
 * still shows up (with a negative balance) instead of being silently dropped.
 */
export async function getInventoryStockSummary(companyId: string) {
    const [{ brands, chemicals, colors }, inventoryRows, extruderRows] = await Promise.all([
        findBrandsChemicalsColors(companyId),
        findInventoryRowsForStock(companyId),
        findExtruderRowsForStock(companyId),
    ]);

    const intakeByBrand = new Map<string, number>();
    const intakeByChemical = new Map<string, number>();
    const intakeByColor = new Map<string, number>();
    for (const row of inventoryRows) {
        const kg = row.weightKg;
        if (row.type === InventoryType.HDPE && row.brandId) intakeByBrand.set(row.brandId, (intakeByBrand.get(row.brandId) ?? 0) + kg);
        else if (row.type === InventoryType.CHEMICAL && row.chemicalId) intakeByChemical.set(row.chemicalId, (intakeByChemical.get(row.chemicalId) ?? 0) + kg);
        else if (row.type === InventoryType.COLOR && row.colorId) intakeByColor.set(row.colorId, (intakeByColor.get(row.colorId) ?? 0) + kg);
    }

    const consumedByBrand = new Map<string, number>();
    const consumedByChemical = new Map<string, number>();
    const consumedByColor = new Map<string, number>();
    for (const row of extruderRows) {
        consumedByBrand.set(row.brandId, (consumedByBrand.get(row.brandId) ?? 0) + row.rawMaterialKg);
        consumedByChemical.set(row.chemicalId, (consumedByChemical.get(row.chemicalId) ?? 0) + row.chemicalKg);
        consumedByColor.set(row.colorId, (consumedByColor.get(row.colorId) ?? 0) + row.colorConsumedKg);
    }

    return {
        rawMaterial: toStockRows(brands, intakeByBrand, consumedByBrand),
        chemical: toStockRows(chemicals, intakeByChemical, consumedByChemical),
        color: toStockRows(colors, intakeByColor, consumedByColor),
    };
}
