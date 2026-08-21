import { Prisma, ProductionStage, ProductionStatus, ApprovalEntityType } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { buildProductionWhere } from '../utils/productionFilters.js';
import { assertBrandExists, assertChemicalExists, assertColorExists, assertSizeExists } from './masterDataService.js';
import { buildWastageCreates, mapWastageRecord, wastageSelect } from './wastageService.js';
import { WASTAGE_CODES } from '../constants/wastageCodes.js';
import type { CreateExtruderInput, UpdateExtruderInput, ListExtruderQuery } from '../validations/extruderValidation.js';

/**
 * The PRD (§16.3) exposes create/list/get/edit/approve/reject for Extruder,
 * with no separate "submit" step (unlike the generic /production resource in
 * §16.2). A created Extruder production is therefore considered submitted for
 * approval immediately: it starts at PENDING_APPROVAL rather than DRAFT, is
 * editable only in that state, and approve/reject resolve it from there.
 */
const EXTRUDER_INITIAL_STATUS = ProductionStatus.PENDING_APPROVAL;

// Match the schema's Decimal(12,3) precision when comparing a caller-supplied
// colour consumption against the configured standard.
const COLOR_CONSUMPTION_TOLERANCE_KG = 0.0005;

const extruderSelect = {
    id: true,
    stage: true,
    productionDate: true,
    status: true,
    statusChangedAt: true,
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

    if (deviatesFromStandard && (!overrideReason || overrideReason.trim().length === 0)) {
        throw new ValidationError(
            'overrideReason is required when colorConsumedKg deviates from the configured standard',
            'OVERRIDE_REASON_REQUIRED',
            { colorId, standardKg },
        );
    }

    return {
        colorConsumedKg: requestedColorConsumedKg,
        isRecipeOverridden: deviatesFromStandard,
        overrideReason: deviatesFromStandard ? (overrideReason as string).trim() : null,
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
            sizeId: input.sizeId,
            status: EXTRUDER_INITIAL_STATUS,
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
        select: { id: true, status: true, colorId: true, extruder: { select: { rawMaterialKg: true } } },
    });
    if (!existing) throw new NotFoundError('Extruder production not found', 'EXTRUDER_NOT_FOUND', { id });

    if (existing.status !== ProductionStatus.PENDING_APPROVAL) {
        throw new ConflictError(
            'Extruder production can only be edited while pending approval',
            'EXTRUDER_NOT_EDITABLE',
            { status: existing.status },
        );
    }

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
        const result = await tx.productionRecord.updateMany({
            where: { id, companyId, stage: ProductionStage.EXTRUDER, status: ProductionStatus.PENDING_APPROVAL },
            data: {
                ...(input.productionDate ? { productionDate: input.productionDate } : {}),
                ...(input.colorId ? { colorId: input.colorId } : {}),
                ...(input.sizeId ? { sizeId: input.sizeId } : {}),
                ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
                updatedBy: actor,
            },
        });

        if (result.count === 0) {
            // Lost a race: status changed between the read above and this write.
            throw new ConflictError(
                'Extruder production status changed before this edit could be applied',
                'EXTRUDER_NOT_EDITABLE',
            );
        }

        await tx.extruderDetail.update({
            where: { productionRecordId: id },
            data: {
                ...(input.brandId ? { brandId: input.brandId } : {}),
                ...(input.rawMaterialKg !== undefined ? { rawMaterialKg: input.rawMaterialKg } : {}),
                ...(input.chemicalId ? { chemicalId: input.chemicalId } : {}),
                ...(input.chemicalKg !== undefined ? { chemicalKg: input.chemicalKg } : {}),
                ...(input.yarnOutputKg !== undefined ? { yarnOutputKg: input.yarnOutputKg } : {}),
                ...(consumption
                    ? {
                          colorConsumedKg: consumption.colorConsumedKg,
                          isRecipeOverridden: consumption.isRecipeOverridden,
                          overrideReason: consumption.overrideReason,
                      }
                    : {}),
            },
        });

        return tx.productionRecord.findUniqueOrThrow({ where: { id }, select: extruderSelect });
    });

    return mapExtruderRecord(updated);
}

async function transitionExtruderStatus(
    id: string,
    companyId: string,
    actor: string,
    toStatus: typeof ProductionStatus.APPROVED | typeof ProductionStatus.REJECTED,
    reason: string | undefined,
) {
    const existing = await prisma.productionRecord.findFirst({
        where: { id, companyId, stage: ProductionStage.EXTRUDER },
        select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundError('Extruder production not found', 'EXTRUDER_NOT_FOUND', { id });

    if (existing.status !== ProductionStatus.PENDING_APPROVAL) {
        throw new ConflictError(
            `Extruder production cannot transition from ${existing.status} to ${toStatus}`,
            'INVALID_STATUS_TRANSITION',
            { from: existing.status, to: toStatus },
        );
    }

    const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.productionRecord.updateMany({
            where: { id, companyId, stage: ProductionStage.EXTRUDER, status: ProductionStatus.PENDING_APPROVAL },
            data: { status: toStatus, statusChangedAt: new Date(), updatedBy: actor },
        });

        if (result.count === 0) {
            // Another request approved/rejected this record first.
            throw new ConflictError(
                `Extruder production cannot transition from ${existing.status} to ${toStatus}`,
                'INVALID_STATUS_TRANSITION',
            );
        }

        await tx.approvalEvent.create({
            data: {
                companyId,
                entityType: ApprovalEntityType.PRODUCTION_RECORD,
                entityId: id,
                fromStatus: ProductionStatus.PENDING_APPROVAL,
                toStatus,
                reason: reason ?? null,
                createdBy: actor,
            },
        });

        // Kora ledger / inventory effects (PRD §8 "Approved Extruder output
        // increases Kora Balance"; §18 Inventory Service) are intentionally not
        // applied here: KoraBalance/KoraLedger/Inventory models do not exist yet
        // in schema.prisma. Wire them into this same transaction once that
        // schema work lands — do not approve without them silently forever.

        return tx.productionRecord.findUniqueOrThrow({ where: { id }, select: extruderSelect });
    });

    return mapExtruderRecord(updated);
}

export function approveExtruderProduction(id: string, companyId: string, actor: string, reason: string | undefined) {
    return transitionExtruderStatus(id, companyId, actor, ProductionStatus.APPROVED, reason);
}

export function rejectExtruderProduction(id: string, companyId: string, actor: string, reason: string | undefined) {
    return transitionExtruderStatus(id, companyId, actor, ProductionStatus.REJECTED, reason);
}
