import { Prisma, ProductionStage } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { buildProductionWhere } from '../utils/productionFilters.js';
import { assertColorExists, assertSizeExists } from './masterDataService.js';
import { buildWastageCreates, mapWastageRecord, wastageSelect } from './wastageService.js';
import { WASTAGE_CODES } from '../constants/wastageCodes.js';
import { creditKoraBalance } from './koraBalanceService.js';
import type { CreateLoomsInput, UpdateLoomsInput, ListLoomsQuery } from '../validations/loomsValidation.js';

/**
 * Looms is PRD §16.4: create/list/get, no approval workflow — records are
 * created directly and are immediately final.
 *
 * Yarn/Kora Balance consumption (PRD §8) is out of scope: Kora Balance isn't
 * modeled in this schema.
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
    createdAt: true,
    createdBy: true,
    updatedAt: true,
    updatedBy: true,
} satisfies Prisma.ProductionRecordSelect;

type LoomsRecordRow = Prisma.ProductionRecordGetPayload<{ select: typeof loomsSelect }>;

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

export async function createLoomsProduction(input: CreateLoomsInput, companyId: string, actor: string) {
    await Promise.all([assertColorExists(input.colorId, companyId), assertSizeExists(input.sizeId, companyId)]);

    // BW (\"Bit Wastage\") is colour-tracked (PRD \"B White\"/\"B Blue\"), so it's
    // stored against this record's own colour; FW (\"Fabric Wastage\") is not.
    const wastageCreates = await buildWastageCreates(ProductionStage.LOOMS, companyId, actor, [
        { code: WASTAGE_CODES.LOOMS_WASTE, quantityKg: input.loomsWasteKg },
    ]);

    const record = await prisma.$transaction(async (tx) => {
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

        // Credit kora balance with the fabric output
        await creditKoraBalance(
            input.colorId,
            input.sizeId,
            input.fabricOutputKg,
            input.productionDate,
            created.id,
            actor,
            tx,
        );

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

export async function updateLoomsProduction(id: string, input: UpdateLoomsInput, companyId: string, actor: string) {
    const existing = await prisma.productionRecord.findFirst({
        where: { id, companyId, stage: ProductionStage.LOOMS },
        select: { id: true },
    });
    if (!existing) throw new NotFoundError('Looms production not found', 'LOOMS_NOT_FOUND', { id });

    await Promise.all([
        input.colorId ? assertColorExists(input.colorId, companyId) : undefined,
        input.sizeId ? assertSizeExists(input.sizeId, companyId) : undefined,
    ]);

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

export async function deleteLoomsProduction(id: string, companyId: string): Promise<void> {
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
