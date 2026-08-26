import { Prisma, ProductionStage } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { buildProductionWhere } from '../utils/productionFilters.js';
import { assertBrandExists, assertChemicalExists, assertColorExists, assertSizeExists } from './masterDataService.js';
import { applyWastageUpdates, buildWastageCreates, mapWastageRecord, wastageSelect } from './wastageService.js';
import { WASTAGE_CODES } from '../constants/wastageCodes.js';
import type { CreateExtruderInput, UpdateExtruderInput, ListExtruderQuery } from '../validations/extruderValidation.js';

/**
 * The PRD (§16.3) exposes create/list/get/edit for Extruder — no approval
 * workflow: a created record is created directly and is immediately final.
 */

// Match the schema's Decimal(12,3) precision when comparing a caller-supplied
// colour consumption against the configured standard.
const COLOR_CONSUMPTION_TOLERANCE_KG = 0.0005;
const DEFAULT_OVERRIDE_REASON = 'Colour consumed was crossing the standard';


const extruderSelect = {
    id: true,
    stage: true,
    productionDate: true,
    remarks: true,
    color: { select: { id: true, name: true } },
    size: { select: { id: true, name: true } },
    extruder: {
        select: {
            brand: { select: { id: true, name: true } },
            rawMaterialKg: true,
            chemical: { select: { id: true, name: true } },
            chemicalKg: true,
            colorConsumedKg: true,
            yarnOutputKg: true,
            isRecipeOverridden: true,
            overrideReason: true,
            bagCount: true,
            bagWeightKg: true,
            looseWeightKg: true,
            totalWeightKg: true,
        },
    },
    wastages: { select: wastageSelect },
    createdAt: true,
    createdBy: true,
    updatedAt: true,
    updatedBy: true,
} satisfies Prisma.ProductionRecordSelect;

type ExtruderRecordRow = Prisma.ProductionRecordGetPayload<{ select: typeof extruderSelect }>;

function mapExtruderRecord(record: ExtruderRecordRow) {
    const { extruder, wastages, ...rest } = record;
    return {
        ...rest,
        extruder: extruder
            ? {
                  brand: extruder.brand,
                  rawMaterialKg: extruder.rawMaterialKg.toNumber(),
                  chemical: extruder.chemical,
                  chemicalKg: extruder.chemicalKg.toNumber(),
                  colorConsumedKg: extruder.colorConsumedKg.toNumber(),
                  yarnOutputKg: extruder.yarnOutputKg.toNumber(),
                  isRecipeOverridden: extruder.isRecipeOverridden,
                  overrideReason: extruder.overrideReason,
                  bagCount: extruder.bagCount,
                  bagWeightKg: extruder.bagWeightKg ? extruder.bagWeightKg.toNumber() : null,
                  looseWeightKg: extruder.looseWeightKg ? extruder.looseWeightKg.toNumber() : null,
                  totalWeightKg: extruder.totalWeightKg ? extruder.totalWeightKg.toNumber() : null,
              }
            : null,
        wastages: wastages.map(mapWastageRecord),
    };
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
 * - No value supplied: falls back to the configured standard (grams/25kg,
 *   scaled to the actual raw-material input). Requires a standard to exist.
 * - Value supplied and it matches the standard (within tolerance): recorded
 *   as-is, not an override.
 * - Value supplied and it deviates from the standard (or none is configured):
 *   recorded as a recipe override, which requires a reason (PRD §6, "Store
 *   original recipe, overridden values, user, timestamp and reason").
 *
 * Time: O(1) — one indexed lookup plus arithmetic.
 */
async function resolveColorConsumption(
    colorId: string,
    rawMaterialKg: number,
    requestedColorConsumedKg: number | undefined,
    overrideReason: string | undefined,
): Promise<ColorConsumptionResolution> {
    const standard = await prisma.colorConsumptionStandard.findUnique({
        where: { colorId },
        select: { gramsPerBasis: true, basisWeightKg: true, isActive: true },
    });

    const standardKg =
        standard && standard.isActive
            ? roundKg((standard.gramsPerBasis.toNumber() / 1000) * (rawMaterialKg / standard.basisWeightKg.toNumber()))
            : null;

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
    const resolvedOverrideReason = deviatesFromStandard
        ? overrideReason?.trim() || DEFAULT_OVERRIDE_REASON
        : null;

    // No overrideReason requirement: isRecipeOverridden still records the deviation, just without forcing a reason.
    return {
        colorConsumedKg: requestedColorConsumedKg,
        isRecipeOverridden: deviatesFromStandard,
        overrideReason: resolvedOverrideReason,
    };
}

export async function createExtruderProduction(input: CreateExtruderInput, companyId: string, actor: string) {
    await Promise.all([
        assertColorExists(input.colorId, companyId),
        assertSizeExists(input.sizeId, companyId),
        assertBrandExists(input.brandId, companyId),
        assertChemicalExists(input.chemicalId, companyId),
    ]);

    const consumption = await resolveColorConsumption(
        input.colorId,
        input.rawMaterialKg,
        input.colorConsumedKg,
        input.overrideReason,
    );

    const wastageCreates = await buildWastageCreates(ProductionStage.EXTRUDER, companyId, actor, [
        { code: WASTAGE_CODES.YARN_WASTE, quantityKg: input.yarnWasteKg },
        { code: WASTAGE_CODES.LUMPS, quantityKg: input.lumpsKg },
    ]);

    const record = await prisma.productionRecord.create({
        data: {
            companyId,
            stage: ProductionStage.EXTRUDER,
            productionDate: input.productionDate,
            colorId: input.colorId,
            type: input.type,
            sizeId: input.sizeId,
            remarks: input.remarks,
            createdBy: actor,
            extruder: {
                create: {
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
                },
            },
            ...(wastageCreates.length > 0 ? { wastages: { create: wastageCreates } } : {}),
        },
        select: extruderSelect,
    });

    return mapExtruderRecord(record);
}

export async function listExtruderProductions(query: ListExtruderQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const where = buildProductionWhere(ProductionStage.EXTRUDER, query, companyId);

    const [rows, total] = await prisma.$transaction([
        prisma.productionRecord.findMany({
            where,
            select: extruderSelect,
            orderBy: [{ productionDate: 'desc' }, { createdAt: 'desc' }],
            skip,
            take,
        }),
        prisma.productionRecord.count({ where }),
    ]);

    return { items: rows.map(mapExtruderRecord), meta: toPageMeta(query, total) };
}

export async function getExtruderProductionById(id: string, companyId: string) {
    const record = await prisma.productionRecord.findFirst({
        where: { id, companyId, stage: ProductionStage.EXTRUDER },
        select: extruderSelect,
    });
    if (!record) throw new NotFoundError('Extruder production not found', 'EXTRUDER_NOT_FOUND', { id });
    return mapExtruderRecord(record);
}

export async function updateExtruderProduction(id: string, input: UpdateExtruderInput, companyId: string, actor: string) {
    const existing = await prisma.productionRecord.findFirst({
        where: { id, companyId, stage: ProductionStage.EXTRUDER },
        select: { id: true, colorId: true, extruder: { select: { rawMaterialKg: true } } },
    });
    if (!existing) throw new NotFoundError('Extruder production not found', 'EXTRUDER_NOT_FOUND', { id });

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
            input.rawMaterialKg ?? (existing.extruder?.rawMaterialKg.toNumber() ?? 0),
            input.colorConsumedKg,
            input.overrideReason,
        );
    }

    const updated = await prisma.$transaction(async (tx) => {
        await tx.productionRecord.update({
            where: { id },
            data: {
                ...(input.productionDate ? { productionDate: input.productionDate } : {}),
                ...(input.colorId ? { colorId: input.colorId } : {}),
                ...(input.sizeId ? { sizeId: input.sizeId } : {}),
                ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
                updatedBy: actor,
            },
        });

        await tx.extruderDetail.update({
            where: { productionRecordId: id },
            data: {
                ...(input.brandId ? { brandId: input.brandId } : {}),
                ...(input.rawMaterialKg !== undefined ? { rawMaterialKg: input.rawMaterialKg } : {}),
                ...(input.chemicalId ? { chemicalId: input.chemicalId } : {}),
                ...(input.chemicalKg !== undefined ? { chemicalKg: input.chemicalKg } : {}),
                ...(input.yarnOutputKg !== undefined ? { yarnOutputKg: input.yarnOutputKg } : {}),
                ...(input.bagCount !== undefined ? { bagCount: input.bagCount } : {}),
                ...(input.bagWeightKg !== undefined ? { bagWeightKg: input.bagWeightKg } : {}),
                ...(input.looseWeightKg !== undefined ? { looseWeightKg: input.looseWeightKg } : {}),
                ...(input.totalWeightKg !== undefined ? { totalWeightKg: input.totalWeightKg } : {}),
                ...(consumption
                    ? {
                          colorConsumedKg: consumption.colorConsumedKg,
                          isRecipeOverridden: consumption.isRecipeOverridden,
                          overrideReason: consumption.overrideReason,
                      }
                    : {}),
            },
        });

        const wastageUpdates = [
            ...(input.yarnWasteKg !== undefined ? [{ code: WASTAGE_CODES.YARN_WASTE, quantityKg: input.yarnWasteKg }] : []),
            ...(input.lumpsKg !== undefined ? [{ code: WASTAGE_CODES.LUMPS, quantityKg: input.lumpsKg }] : []),
        ];
        if (wastageUpdates.length > 0) {
            await applyWastageUpdates(tx, id, ProductionStage.EXTRUDER, companyId, actor, wastageUpdates);
        }

        return tx.productionRecord.findUniqueOrThrow({ where: { id }, select: extruderSelect });
    });

    return mapExtruderRecord(updated);
}

export async function deleteExtruderProduction(id: string, companyId: string): Promise<void> {
    const existing = await prisma.productionRecord.findFirst({
        where: { id, companyId, stage: ProductionStage.EXTRUDER },
        select: { id: true },
    });
    if (!existing) throw new NotFoundError('Extruder production not found', 'EXTRUDER_NOT_FOUND', { id });

    await prisma.$transaction(async (tx) => {
        // WastageRecord has no onDelete: Cascade to ProductionRecord, so it
        // must be cleared explicitly before the record itself can be deleted.
        await tx.wastageRecord.deleteMany({ where: { productionRecordId: id } });
        await tx.productionRecord.delete({ where: { id } });
    });
}
