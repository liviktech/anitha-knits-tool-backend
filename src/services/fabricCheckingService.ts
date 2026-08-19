import { Prisma, ProductionStage, ProductionStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { buildProductionWhere } from '../utils/productionFilters.js';
import { assertColorExists, assertSizeExists } from './masterDataService.js';
import type { CreateFabricCheckingInput, ListFabricCheckingQuery } from '../validations/fabricCheckingValidation.js';

/**
 * Fabric Checking is PRD §16.7 (base path /api/v1/fabric-checking, not nested
 * under /production/): create/list/get/edit/approve/reject, no separate
 * "submit" step — same reasoning as Extruder/Looms. A created record is
 * therefore stored PENDING_APPROVAL directly.
 *
 * FW/BW wastage (PRD §10) is recorded through the separate WastageRecord/
 * Wastage API, not embedded here — same pattern as Extruder's Yarn Waste.
 * GSM (PRD §11) is intentionally out of scope: no GSMCheck model exists in
 * schema.prisma yet.
 *
 * First/second grade are not validated against fabricInputKg here — the
 * domain skill is explicit that reconciliation variances must stay visible
 * for management review, not be silently forced to match.
 */
const FABRIC_CHECKING_INITIAL_STATUS = ProductionStatus.PENDING_APPROVAL;

const fabricCheckingSelect = {
    id: true,
    stage: true,
    productionDate: true,
    status: true,
    statusChangedAt: true,
    remarks: true,
    color: { select: { id: true, name: true } },
    size: { select: { id: true, name: true } },
    fabricCheck: {
        select: {
            fabricInputKg: true,
            pieceCount: true,
            firstGradeKg: true,
            secondGradeKg: true,
        },
    },
    createdAt: true,
    createdBy: true,
    updatedAt: true,
    updatedBy: true,
} satisfies Prisma.ProductionRecordSelect;

type FabricCheckingRecordRow = Prisma.ProductionRecordGetPayload<{ select: typeof fabricCheckingSelect }>;

function mapFabricCheckingRecord(record: FabricCheckingRecordRow) {
    const { fabricCheck, ...rest } = record;
    return {
        ...rest,
        fabricCheck: fabricCheck
            ? {
                  fabricInputKg: fabricCheck.fabricInputKg.toNumber(),
                  pieceCount: fabricCheck.pieceCount,
                  firstGradeKg: fabricCheck.firstGradeKg.toNumber(),
                  secondGradeKg: fabricCheck.secondGradeKg.toNumber(),
              }
            : null,
    };
}

export async function createFabricCheckingRecord(input: CreateFabricCheckingInput, actor: string) {
    await Promise.all([assertColorExists(input.colorId), assertSizeExists(input.sizeId)]);

    const record = await prisma.productionRecord.create({
        data: {
            stage: ProductionStage.FABRIC_CHECKING,
            productionDate: input.productionDate,
            colorId: input.colorId,
            sizeId: input.sizeId,
            status: FABRIC_CHECKING_INITIAL_STATUS,
            remarks: input.remarks,
            createdBy: actor,
            fabricCheck: {
                create: {
                    fabricInputKg: input.fabricInputKg,
                    pieceCount: input.pieceCount,
                    firstGradeKg: input.firstGradeKg,
                    secondGradeKg: input.secondGradeKg,
                },
            },
        },
        select: fabricCheckingSelect,
    });

    return mapFabricCheckingRecord(record);
}

export async function listFabricCheckingRecords(query: ListFabricCheckingQuery) {
    const { skip, take } = toSkipTake(query);
    const where = buildProductionWhere(ProductionStage.FABRIC_CHECKING, query);

    const [rows, total] = await prisma.$transaction([
        prisma.productionRecord.findMany({
            where,
            select: fabricCheckingSelect,
            orderBy: [{ productionDate: 'desc' }, { createdAt: 'desc' }],
            skip,
            take,
        }),
        prisma.productionRecord.count({ where }),
    ]);

    return { items: rows.map(mapFabricCheckingRecord), meta: toPageMeta(query, total) };
}

export async function getFabricCheckingRecordById(id: string) {
    const record = await prisma.productionRecord.findFirst({
        where: { id, stage: ProductionStage.FABRIC_CHECKING },
        select: fabricCheckingSelect,
    });
    if (!record) throw new NotFoundError('Fabric checking record not found', 'FABRIC_CHECKING_NOT_FOUND', { id });
    return mapFabricCheckingRecord(record);
}
