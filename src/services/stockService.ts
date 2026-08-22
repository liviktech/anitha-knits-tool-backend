import { InventoryType } from '@prisma/client';
import { prisma } from '../config/prisma.js';

function roundKg(value: number): number {
    return Math.round(value * 1000) / 1000;
}

type StockRow = { id: string; name: string; intakeKg: number; consumedKg: number; stockKg: number };

function toStockRows(
    items: { id: string; name: string }[],
    intakeById: Map<string, number>,
    consumedById: Map<string, number>,
): StockRow[] {
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
    const [brands, chemicals, colors, inventoryRows, extruderRows] = await Promise.all([
        prisma.brand.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.chemical.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.color.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.inventory.findMany({
            where: { companyId },
            select: { type: true, weightKg: true, brandId: true, chemicalId: true, colorId: true },
        }),
        prisma.extruderDetail.findMany({
            where: { productionRecord: { companyId } },
            select: {
                brandId: true,
                rawMaterialKg: true,
                chemicalId: true,
                chemicalKg: true,
                colorConsumedKg: true,
                productionRecord: { select: { colorId: true } },
            },
        }),
    ]);

    const intakeByBrand = new Map<string, number>();
    const intakeByChemical = new Map<string, number>();
    const intakeByColor = new Map<string, number>();
    for (const row of inventoryRows) {
        const kg = row.weightKg.toNumber();
        if (row.type === InventoryType.RAW_MATERIAL && row.brandId) intakeByBrand.set(row.brandId, kg);
        else if (row.type === InventoryType.CHEMICAL && row.chemicalId) intakeByChemical.set(row.chemicalId, kg);
        else if (row.type === InventoryType.COLOR && row.colorId) intakeByColor.set(row.colorId, kg);
    }

    const consumedByBrand = new Map<string, number>();
    const consumedByChemical = new Map<string, number>();
    const consumedByColor = new Map<string, number>();
    for (const row of extruderRows) {
        consumedByBrand.set(row.brandId, (consumedByBrand.get(row.brandId) ?? 0) + row.rawMaterialKg.toNumber());
        consumedByChemical.set(row.chemicalId, (consumedByChemical.get(row.chemicalId) ?? 0) + row.chemicalKg.toNumber());
        const colorId = row.productionRecord.colorId;
        consumedByColor.set(colorId, (consumedByColor.get(colorId) ?? 0) + row.colorConsumedKg.toNumber());
    }

    return {
        rawMaterial: toStockRows(brands, intakeByBrand, consumedByBrand),
        chemical: toStockRows(chemicals, intakeByChemical, consumedByChemical),
        color: toStockRows(colors, intakeByColor, consumedByColor),
    };
}
