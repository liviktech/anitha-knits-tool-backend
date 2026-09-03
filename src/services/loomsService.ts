import { Prisma, ProductionStage, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { buildProductionWhere } from '../utils/productionFilters.js';
import { assertColorExists, assertSizeExists } from './masterDataService.js';
import { buildWastageCreates, mapWastageRecord, wastageSelect } from './wastageService.js';
import { WASTAGE_CODES } from '../constants/wastageCodes.js';
import { assertCanCreateProductionRecord, assertCanDeleteProductionRecord, assertCanUpdateProductionRecord } from './productionCeilings.js';
import type { CreateLoomsInput, UpdateLoomsInput, ListLoomsQuery } from '../validations/loomsValidation.js';

/**
 * Looms is PRD §16.4: create/list/get, no approval workflow — records are
 * created directly and are immediately final.
 *
 * Yarn/Kora Balance consumption (PRD §8) beyond the Extruder-yarn-availability
 * check below is out of scope: Kora Balance isn't modeled in this schema.
 */
const loomsSelect = {
    id: true,
    stage: true,
    productionDate: true,
    remarks: true,
    color: { select: { id: true, name: true } },
    size: { select: { id: true, name: true } },
    loom: {
        select: {
            yarnInputKg: true,
            fabricOutputKg: true,
        },
    },
    wastages: { select: wastageSelect },
    isApproved: true,
    approvedAt: true,
    approvedBy: true,
    createdAt: true,
    createdBy: true,
    updatedAt: true,
    updatedBy: true,
} satisfies Prisma.ProductionRecordSelect;

type LoomsRecordRow = Prisma.ProductionRecordGetPayload<{ select: typeof loomsSelect }>;

/**
 * Looms consumes yarn produced at the Extruder stage, so a colour+size variant can't
 * take in more yarn than Extruder has ever produced for it, net of what Looms has
 * already consumed. Cumulative across all history — mirrors
 * fabricCheckingService.getAvailableFabricKg for the Looms→Fabric Checking stage.
 *
 * `excludeRecordId` omits a record's own existing yarnInputKg from the "already
 * consumed" side, so re-validating an update against its own prior value isn't a
 * false rejection.
 */
async function getAvailableYarnKg(
    companyId: string,
    colorId: string,
    sizeId: string,
    tx: Prisma.TransactionClient | typeof prisma,
    excludeRecordId?: string,
): Promise<Prisma.Decimal> {
    const [extruderAgg, loomAgg] = await Promise.all([
        tx.extruderDetail.aggregate({
            where: { productionRecord: { companyId, stage: ProductionStage.EXTRUDER, colorId, sizeId } },
            _sum: { yarnOutputKg: true },
        }),
        tx.loomDetail.aggregate({
            where: {
                productionRecord: { companyId, stage: ProductionStage.LOOMS, colorId, sizeId },
                ...(excludeRecordId ? { productionRecordId: { not: excludeRecordId } } : {}),
            },
            _sum: { yarnInputKg: true },
        }),
    ]);

    return (extruderAgg._sum.yarnOutputKg ?? new Prisma.Decimal(0)).minus(loomAgg._sum.yarnInputKg ?? new Prisma.Decimal(0));
}

async function assertYarnInputWithinAvailable(
    companyId: string,
    colorId: string,
    sizeId: string,
    yarnInputKg: number,
    tx: Prisma.TransactionClient | typeof prisma,
    excludeRecordId?: string,
): Promise<void> {
    const availableKg = await getAvailableYarnKg(companyId, colorId, sizeId, tx, excludeRecordId);
    if (new Prisma.Decimal(yarnInputKg).greaterThan(availableKg)) {
        throw new ConflictError(
            `Loom Production (${yarnInputKg} kg) exceeds the available Extruder yarn for this colour and size (${availableKg.toFixed(3)} kg available)`,
            'YARN_INPUT_EXCEEDS_AVAILABLE',
            { colorId, sizeId, availableKg: availableKg.toNumber(), requestedKg: yarnInputKg },
        );
    }
}

/** Backs GET /production/looms/available — lets the entry form show/validate against the same cumulative figure the create/update guard enforces. */
export async function getAvailableYarnStockKg(companyId: string, colorId: string, sizeId: string): Promise<number> {
    const availableKg = await getAvailableYarnKg(companyId, colorId, sizeId, prisma);
    return availableKg.toNumber();
}

function mapLoomsRecord(record: LoomsRecordRow) {
    const { loom, wastages, ...rest } = record;
    return {
        ...rest,
        loom: loom
            ? {
                yarnInputKg: loom.yarnInputKg.toNumber(),
                fabricOutputKg: loom.fabricOutputKg.toNumber(),
            }
            : null,
        wastages: wastages.map(mapWastageRecord),
    };
}

export async function createLoomsProduction(
    input: CreateLoomsInput,
    companyId: string,
    actor: string,
    role: UserRole,
    callerId: string,
) {
    await assertCanCreateProductionRecord(role, callerId, companyId);

    await Promise.all([assertColorExists(input.colorId, companyId), assertSizeExists(input.sizeId, companyId)]);

    // BW (\"Bit Wastage\") is colour-tracked (PRD \"B White\"/\"B Blue\"), so it's
    // stored against this record's own colour; FW (\"Fabric Wastage\") is not.
    const wastageCreates = await buildWastageCreates(ProductionStage.LOOMS, companyId, actor, [
        { code: WASTAGE_CODES.LOOMS_WASTE, quantityKg: input.loomsWasteKg },
    ]);

    const record = await prisma.$transaction(async (tx) => {
        await assertYarnInputWithinAvailable(companyId, input.colorId, input.sizeId, input.yarnInputKg, tx);

        const created = await tx.productionRecord.create({
            data: {
                companyId,
                stage: ProductionStage.LOOMS,
                productionDate: input.productionDate,
                colorId: input.colorId,
                sizeId: input.sizeId,
                remarks: input.remarks,
                createdBy: actor,
                loom: {
                    create: {
                        yarnInputKg: input.yarnInputKg,
                        fabricOutputKg: input.fabricOutputKg,
                    },
                },
                ...(wastageCreates.length > 0 ? { wastages: { create: wastageCreates } } : {}),
            },
            select: loomsSelect,
        });

        // Kora balance is no longer credited here — it's credited lazily from the
        // matching Loom record's fabricOutputKg when Fabric Checking is created
        // against this color+size (see fabricCheckingService.createFabricCheckingRecord).
        return created;
    });

    return mapLoomsRecord(record);
}

export async function listLoomsProductions(query: ListLoomsQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const where = buildProductionWhere(ProductionStage.LOOMS, query, companyId);

    const [rows, total] = await prisma.$transaction([
        prisma.productionRecord.findMany({
            where,
            select: loomsSelect,
            orderBy: [{ productionDate: 'desc' }, { createdAt: 'desc' }],
            skip,
            take,
        }),
        prisma.productionRecord.count({ where }),
    ]);

    return { items: rows.map(mapLoomsRecord), meta: toPageMeta(query, total) };
}

export async function getLoomsProductionById(id: string, companyId: string) {
    const record = await prisma.productionRecord.findFirst({
        where: { id, companyId, stage: ProductionStage.LOOMS },
        select: loomsSelect,
    });
    if (!record) throw new NotFoundError('Looms production not found', 'LOOMS_NOT_FOUND', { id });
    return mapLoomsRecord(record);
}

export async function updateLoomsProduction(
    id: string,
    input: UpdateLoomsInput,
    companyId: string,
    actor: string,
    role: UserRole,
    callerId: string,
) {
    const existing = await prisma.productionRecord.findFirst({
        where: { id, companyId, stage: ProductionStage.LOOMS },
        select: { id: true, isApproved: true, colorId: true, sizeId: true },
    });
    if (!existing) throw new NotFoundError('Looms production not found', 'LOOMS_NOT_FOUND', { id });

    await assertCanUpdateProductionRecord(role, callerId, companyId, existing.isApproved);

    await Promise.all([
        input.colorId ? assertColorExists(input.colorId, companyId) : undefined,
        input.sizeId ? assertSizeExists(input.sizeId, companyId) : undefined,
    ]);

    const updated = await prisma.$transaction(async (tx) => {
        if (input.yarnInputKg !== undefined || input.colorId !== undefined || input.sizeId !== undefined) {
            await assertYarnInputWithinAvailable(
                companyId,
                input.colorId ?? existing.colorId,
                input.sizeId ?? existing.sizeId,
                input.yarnInputKg ?? (await tx.loomDetail.findUniqueOrThrow({ where: { productionRecordId: id }, select: { yarnInputKg: true } })).yarnInputKg.toNumber(),
                tx,
                id,
            );
        }

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

        await tx.loomDetail.update({
            where: { productionRecordId: id },
            data: {
                ...(input.yarnInputKg !== undefined ? { yarnInputKg: input.yarnInputKg } : {}),
                ...(input.fabricOutputKg !== undefined ? { fabricOutputKg: input.fabricOutputKg } : {}),
            },
        });

        return tx.productionRecord.findUniqueOrThrow({ where: { id }, select: loomsSelect });
    });

    return mapLoomsRecord(updated);
}

export async function deleteLoomsProduction(id: string, companyId: string, role: UserRole): Promise<void> {
    assertCanDeleteProductionRecord(role);

    const existing = await prisma.productionRecord.findFirst({
        where: { id, companyId, stage: ProductionStage.LOOMS },
        select: { id: true },
    });
    if (!existing) throw new NotFoundError('Looms production not found', 'LOOMS_NOT_FOUND', { id });

    await prisma.$transaction(async (tx) => {
        // WastageRecord has no onDelete: Cascade to ProductionRecord, so it
        // must be cleared explicitly before the record itself can be deleted.
        await tx.wastageRecord.deleteMany({ where: { productionRecordId: id } });
        await tx.productionRecord.delete({ where: { id } });
    });
}

/** ADMIN-only (enforced at the route level) — sets isApproved, never exposed via Right/RoleAccess. */
export async function approveLoomsProduction(id: string, companyId: string, actor: string) {
    const existing = await prisma.productionRecord.findFirst({
        where: { id, companyId, stage: ProductionStage.LOOMS },
        select: { id: true },
    });
    if (!existing) throw new NotFoundError('Looms production not found', 'LOOMS_NOT_FOUND', { id });

    const record = await prisma.productionRecord.update({
        where: { id },
        data: { isApproved: true, approvedAt: new Date(), approvedBy: actor },
        select: loomsSelect,
    });
    return mapLoomsRecord(record);
}

export async function getLoomsProductionSummaryByDateRange(companyId: string, dateFrom: Date, dateTo: Date) {
    const rows = await prisma.productionRecord.findMany({
        where: { companyId, stage: ProductionStage.LOOMS, productionDate: { gte: dateFrom, lte: dateTo } },
        select: {
            color: { select: { id: true, name: true } },
            loom: { select: { fabricOutputKg: true } },
            wastages: { select: { quantityKg: true, wastageType: { select: { code: true } } } },
        },
    });

    const byColorMap = new Map<string, { color: { id: string; name: string }; production: number; waste: number }>();

    for (const row of rows) {
        const colorKey = row.color?.id ?? 'UNSPECIFIED';
        let entry = byColorMap.get(colorKey);
        if (!entry) {
            entry = { color: row.color ?? { id: 'UNSPECIFIED', name: 'Unspecified' }, production: 0, waste: 0 };
            byColorMap.set(colorKey, entry);
        }
        entry.production += row.loom?.fabricOutputKg?.toNumber() ?? 0;
        for (const w of row.wastages) {
            if (w.wastageType.code === WASTAGE_CODES.LOOMS_WASTE) {
                entry.waste += w.quantityKg.toNumber();
            }
        }
    }

    const roundKg = (val: number) => Math.round(val * 1000) / 1000;

    return Array.from(byColorMap.values()).map(e => ({
        ...e,
        production: roundKg(e.production),
        waste: roundKg(e.waste),
        total: roundKg(e.production + e.waste),
    }));
}