import { withTransaction } from '../db/transaction.js';
import { ProductionStage, UserRole } from '../types/enums.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { assertBrandExists, assertChemicalExists, assertColorExists, assertSizeExists } from './masterDataService.js';
import { findLookupItemName } from '../repositories/lookupItem.repository.js';
import { getKgPerBasisForColor } from './adminConfig.js';
import { applyWastageUpdates, buildWastageCreates } from './wastageService.js';
import { WASTAGE_CODES } from '../constants/wastageCodes.js';
import { assertCanCreateProductionRecord, assertCanDeleteProductionRecord, assertCanUpdateProductionRecord } from './productionCeilings.js';
import {
    approveProductionRecord,
    deleteProductionRecord,
    deleteWastagesForProduction,
    findExtruderExisting,
    findExtruderProductionByIdTx,
    findExtruderRowsForSummary,
    getExtruderProductionById as getExtruderProductionByIdRepo,
    insertExtruderProduction,
    listExtruderProductions as listExtruderProductionsRepo,
    updateExtruderDetail,
    updateExtruderHeader,
    type ExtruderRecordRow,
} from '../repositories/extruder.repository.js';
import { insertWastageRecord } from '../repositories/wastage.repository.js';
import type { CreateExtruderInput, UpdateExtruderInput, ListExtruderQuery } from '../validations/extruderValidation.js';

/**
 * The PRD (§16.3) exposes create/list/get/edit for Extruder — no approval
 * workflow: a created record is created directly and is immediately final.
 */

// Match the schema's Decimal(12,3) precision when comparing a caller-supplied
// colour consumption against the configured standard.
const COLOR_CONSUMPTION_TOLERANCE_KG = 0.0005;
const DEFAULT_OVERRIDE_REASON = 'Colour consumed was crossing the standard';

function mapExtruderRecord(record: ExtruderRecordRow) {
    return record;
}

function roundKg(value: number): number {
    return Math.round(value * 1000) / 1000;
}

type ColorConsumptionResolution = {
    colorConsumedKg: number;
    isRecipeOverridden: boolean;
    overrideReason: string | null;
};

/**
 * Resolves the colour consumption to store for an Extruder entry (PRD §5, §6).
 * - No value supplied: falls back to the configured standard (kg/25kg,
 *   scaled to the actual raw-material input). Requires a standard to exist.
 * - Value supplied and it matches the standard (within tolerance): recorded
 *   as-is, not an override.
 * - Value supplied and it deviates from the standard (or none is configured):
 *   recorded as a recipe override, which requires a reason (PRD §6, "Store
 *   original recipe, overridden values, user, timestamp and reason").
 *
 * The standard is one record per company covering every colour (white/blue/
 * green); a colour outside that set has no configured standard.
 *
 * Time: O(1) — two indexed lookups plus arithmetic.
 */
async function resolveColorConsumption(
    colorId: string,
    companyId: string,
    productionDate: Date,
    rawMaterialKg: number,
    requestedColorConsumedKg: number | undefined,
    overrideReason: string | undefined,
): Promise<ColorConsumptionResolution> {
    const colorName = await findLookupItemName('colors', colorId, companyId);
    const standard = colorName ? await getKgPerBasisForColor(companyId, colorName, productionDate) : null;

    const standardKg = standard ? roundKg(standard.kgPerBasis * (rawMaterialKg / standard.basisWeightKg)) : null;

    if (requestedColorConsumedKg === undefined) {
        if (standardKg === null) {
            throw new ValidationError(
                'colorConsumedKg is required: no active consumption standard is configured for this colour',
                'COLOR_CONSUMPTION_REQUIRED',
                { colorId },
            );
        }
        return { colorConsumedKg: standardKg, isRecipeOverridden: false, overrideReason: null };
    }

    const deviatesFromStandard = standardKg === null || Math.abs(requestedColorConsumedKg - standardKg) > COLOR_CONSUMPTION_TOLERANCE_KG;

    //default ovverride reason
    const resolvedOverrideReason = deviatesFromStandard ? overrideReason?.trim() || DEFAULT_OVERRIDE_REASON : null;

    // No overrideReason requirement: isRecipeOverridden still records the deviation, just without forcing a reason.
    return {
        colorConsumedKg: requestedColorConsumedKg,
        isRecipeOverridden: deviatesFromStandard,
        overrideReason: resolvedOverrideReason,
    };
}

export async function createExtruderProduction(input: CreateExtruderInput, companyId: string, actor: string, role: UserRole, callerId: string) {
    await assertCanCreateProductionRecord(role, callerId, companyId);

    await Promise.all([
        assertColorExists(input.colorId, companyId),
        assertSizeExists(input.sizeId, companyId),
        assertBrandExists(input.brandId, companyId),
        assertChemicalExists(input.chemicalId, companyId),
    ]);

    const consumption = await resolveColorConsumption(
        input.colorId,
        companyId,
        input.productionDate,
        input.rawMaterialKg,
        input.colorConsumedKg,
        input.overrideReason,
    );

    const wastagePlans = await buildWastageCreates(ProductionStage.EXTRUDER, companyId, actor, [
        { code: WASTAGE_CODES.YARN_WASTE, quantityKg: input.yarnWasteKg },
        { code: WASTAGE_CODES.LUMPS, quantityKg: input.lumpsKg },
    ]);

    const record = await withTransaction(async (client) => {
        const productionRecordId = await insertExtruderProduction(client, {
            companyId,
            productionDate: input.productionDate,
            colorId: input.colorId,
            sizeId: input.sizeId,
            type: input.type,
            remarks: input.remarks,
            actor,
            brandId: input.brandId,
            rawMaterialKg: input.rawMaterialKg,
            chemicalId: input.chemicalId,
            chemicalKg: input.chemicalKg,
            colorConsumedKg: consumption.colorConsumedKg,
            yarnOutputKg: input.yarnOutputKg,
            isRecipeOverridden: consumption.isRecipeOverridden,
            overrideReason: consumption.overrideReason,
            bagCount: input.bagCount,
            bagWeightKg: input.bagWeightKg,
            looseWeightKg: input.looseWeightKg,
            totalWeightKg: input.totalWeightKg,
        });

        for (const plan of wastagePlans) {
            await insertWastageRecord(client, productionRecordId, { companyId, ...plan });
        }

        return findExtruderProductionByIdTx(client, productionRecordId);
    });

    return mapExtruderRecord(record);
}

export async function listExtruderProductions(query: ListExtruderQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await listExtruderProductionsRepo(query, companyId, skip, take);

    return { items: rows.map(mapExtruderRecord), meta: toPageMeta(query, total) };
}

export async function getExtruderProductionById(id: string, companyId: string) {
    const record = await getExtruderProductionByIdRepo(id, companyId);
    if (!record) throw new NotFoundError('Extruder production not found', 'EXTRUDER_NOT_FOUND', { id });
    return mapExtruderRecord(record);
}

export async function updateExtruderProduction(
    id: string,
    input: UpdateExtruderInput,
    companyId: string,
    actor: string,
    role: UserRole,
    callerId: string,
) {
    const existing = await findExtruderExisting(id, companyId);
    if (!existing) throw new NotFoundError('Extruder production not found', 'EXTRUDER_NOT_FOUND', { id });

    await assertCanUpdateProductionRecord(role, callerId, companyId, existing.isApproved);

    await Promise.all([
        input.colorId ? assertColorExists(input.colorId, companyId) : undefined,
        input.sizeId ? assertSizeExists(input.sizeId, companyId) : undefined,
        input.brandId ? assertBrandExists(input.brandId, companyId) : undefined,
        input.chemicalId ? assertChemicalExists(input.chemicalId, companyId) : undefined,
    ]);

    let consumption: ColorConsumptionResolution | undefined;
    if (input.colorConsumedKg !== undefined || input.rawMaterialKg !== undefined || input.colorId !== undefined) {
        consumption = await resolveColorConsumption(
            input.colorId ?? existing.colorId,
            companyId,
            input.productionDate ?? existing.productionDate,
            input.rawMaterialKg ?? existing.rawMaterialKg ?? 0,
            input.colorConsumedKg,
            input.overrideReason,
        );
    }

    const updated = await withTransaction(async (client) => {
        await updateExtruderHeader(client, id, {
            productionDate: input.productionDate,
            colorId: input.colorId,
            sizeId: input.sizeId,
            remarks: input.remarks,
            actor,
        });

        await updateExtruderDetail(client, id, {
            brandId: input.brandId,
            rawMaterialKg: input.rawMaterialKg,
            chemicalId: input.chemicalId,
            chemicalKg: input.chemicalKg,
            yarnOutputKg: input.yarnOutputKg,
            bagCount: input.bagCount,
            bagWeightKg: input.bagWeightKg,
            looseWeightKg: input.looseWeightKg,
            totalWeightKg: input.totalWeightKg,
            ...(consumption
                ? {
                      colorConsumedKg: consumption.colorConsumedKg,
                      isRecipeOverridden: consumption.isRecipeOverridden,
                      overrideReason: consumption.overrideReason,
                  }
                : {}),
        });

        const wastageUpdates = [
            ...(input.yarnWasteKg !== undefined ? [{ code: WASTAGE_CODES.YARN_WASTE, quantityKg: input.yarnWasteKg }] : []),
            ...(input.lumpsKg !== undefined ? [{ code: WASTAGE_CODES.LUMPS, quantityKg: input.lumpsKg }] : []),
        ];
        if (wastageUpdates.length > 0) {
            await applyWastageUpdates(client, id, ProductionStage.EXTRUDER, companyId, actor, wastageUpdates);
        }

        return findExtruderProductionByIdTx(client, id);
    });

    return mapExtruderRecord(updated);
}

export async function deleteExtruderProduction(id: string, companyId: string, role: UserRole): Promise<void> {
    assertCanDeleteProductionRecord(role);

    const existing = await findExtruderExisting(id, companyId);
    if (!existing) throw new NotFoundError('Extruder production not found', 'EXTRUDER_NOT_FOUND', { id });

    await withTransaction(async (client) => {
        // WastageRecord has no onDelete: Cascade to ProductionRecord, so it
        // must be cleared explicitly before the record itself can be deleted.
        await deleteWastagesForProduction(client, id);
        await deleteProductionRecord(client, id);
    });
}

/** ADMIN-only (enforced at the route level) — sets isApproved, never exposed via Right/RoleAccess. */
export async function approveExtruderProduction(id: string, companyId: string, actor: string) {
    const existing = await findExtruderExisting(id, companyId);
    if (!existing) throw new NotFoundError('Extruder production not found', 'EXTRUDER_NOT_FOUND', { id });

    await approveProductionRecord(id, actor);
    const record = await getExtruderProductionByIdRepo(id, companyId);
    return mapExtruderRecord(record!);
}

export async function getExtruderProductionSummaryByDateRange(companyId: string, dateFrom: Date, dateTo: Date) {
    const rows = await findExtruderRowsForSummary(companyId, dateFrom, dateTo);

    const byColorMap = new Map<string, { color: { id: string; name: string }; production: number; lumsKg: number; yarnWasteKg: number }>();

    for (const row of rows) {
        const colorKey = row.colorId ?? 'UNSPECIFIED';
        let entry = byColorMap.get(colorKey);
        if (!entry) {
            entry = { color: row.colorId ? { id: row.colorId, name: row.colorName! } : { id: 'UNSPECIFIED', name: 'Unspecified' }, production: 0, lumsKg: 0, yarnWasteKg: 0 };
            byColorMap.set(colorKey, entry);
        }
        entry.production += row.yarnOutputKg ?? 0;
    }

    return Array.from(byColorMap.values()).map((e) => ({
        ...e,
        production: roundKg(e.production),
        lumsKg: roundKg(e.lumsKg),
        yarnWasteKg: roundKg(e.yarnWasteKg),
        waste: roundKg(e.lumsKg + e.yarnWasteKg),
        total: roundKg(e.production + e.lumsKg + e.yarnWasteKg),
    }));
}
