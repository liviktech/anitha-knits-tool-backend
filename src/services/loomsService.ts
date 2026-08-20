import { Prisma, ProductionStage, ProductionStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { buildProductionWhere } from '../utils/productionFilters.js';
import { assertColorExists, assertSizeExists } from './masterDataService.js';
import { buildWastageCreates, mapWastageRecord, wastageSelect } from './wastageService.js';
import { WASTAGE_CODES } from '../constants/wastageCodes.js';
import type { CreateLoomsInput, ListLoomsQuery } from '../validations/loomsValidation.js';

/**
 * Looms is PRD §16.4: create/list/get/edit/approve/reject, no separate "submit"
 * step (same reasoning as Extruder — see extruderService.ts). A created Looms
 * production is therefore stored PENDING_APPROVAL directly.
 *
 * Kora Balance consumption ("approved Looms yarn consumption decreases Kora
 * Balance", PRD §8) is an approval-time effect and out of scope until the
 * approve endpoint is built — see the same caveat in extruderService.ts.
 */
const LOOMS_INITIAL_STATUS = ProductionStatus.PENDING_APPROVAL;

const loomsSelect = {
    id: true,
    stage: true,
    productionDate: true,
    status: true,
    statusChangedAt: true,
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

export async function createLoomsProduction(input: CreateLoomsInput, actor: string) {
    await Promise.all([assertColorExists(input.colorId), assertSizeExists(input.sizeId)]);

    const wastageCreates = await buildWastageCreates(ProductionStage.LOOMS, actor, [
        { code: WASTAGE_CODES.LOOMS_WASTE, quantityKg: input.loomsWasteKg },
    ]);

    const record = await prisma.productionRecord.create({
        data: {
            stage: ProductionStage.LOOMS,
            productionDate: input.productionDate,
            colorId: input.colorId,
            sizeId: input.sizeId,
            status: LOOMS_INITIAL_STATUS,
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

    return mapLoomsRecord(record);
}

export async function listLoomsProductions(query: ListLoomsQuery) {
    const { skip, take } = toSkipTake(query);
    const where = buildProductionWhere(ProductionStage.LOOMS, query);

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

export async function getLoomsProductionById(id: string) {
    const record = await prisma.productionRecord.findFirst({
        where: { id, stage: ProductionStage.LOOMS },
        select: loomsSelect,
    });
    if (!record) throw new NotFoundError('Looms production not found', 'LOOMS_NOT_FOUND', { id });
    return mapLoomsRecord(record);
}
