import { Prisma, ProductionStage, ProductionStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { buildProductionWhere } from '../utils/productionFilters.js';
import { assertColorExists, assertSizeExists } from './masterDataService.js';
import { buildWastageCreates, mapWastageRecord, wastageSelect } from './wastageService.js';
import { WASTAGE_CODES } from '../constants/wastageCodes.js';
import type { CreateFabricCheckingInput, ListFabricCheckingQuery } from '../validations/fabricCheckingValidation.js';

/**
 * Fabric Checking is PRD §16.7 (base path /api/v1/fabric-checking, not nested
 * under /production/): create/list/get/edit/approve/reject, no separate
 * "submit" step — same reasoning as Extruder/Looms. A created record is
 * therefore stored PENDING_APPROVAL directly.
 *
 * FW/BW wastage (PRD §10) is accepted via optional fwKg/bwKg on create and
 * turned into WastageRecord rows in the same transaction (see
 * wastageService.ts) — there's no separate Wastage API yet to enter it
 * through, so this is the only way it gets recorded today. BW is colour-
 * tracked (PRD "B White"/"B Blue"); FW is not.
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
            outputKg: true,
        },
    },
    wastages: { select: wastageSelect },
    createdAt: true,
    createdBy: true,
    updatedAt: true,
    updatedBy: true,
} satisfies Prisma.ProductionRecordSelect;

type FabricCheckingRecordRow = Prisma.ProductionRecordGetPayload<{ select: typeof fabricCheckingSelect }>;

function mapFabricCheckingRecord(record: FabricCheckingRecordRow) {
    const { fabricCheck, wastages, ...rest } = record;
    return {
        ...rest,
        fabricCheck: fabricCheck
            ? {
                  fabricInputKg: fabricCheck.fabricInputKg.toNumber(),
                  pieceCount: fabricCheck.pieceCount,
                  firstGradeKg: fabricCheck.firstGradeKg.toNumber(),
                  secondGradeKg: fabricCheck.secondGradeKg.toNumber(),
                  outputKg: fabricCheck.outputKg ? fabricCheck.outputKg.toNumber() : null,
              }
            : null,
        wastages: wastages.map(mapWastageRecord),
    };
}

export async function createFabricCheckingRecord(input: CreateFabricCheckingInput, companyId: string, actor: string) {
    await Promise.all([assertColorExists(input.colorId, companyId), assertSizeExists(input.sizeId, companyId)]);

    // BW ("Bit Wastage") is colour-tracked (PRD "B White"/"B Blue"), so it's
    // stored against this record's own colour; FW ("Fabric Wastage") is not.
    const wastageCreates = await buildWastageCreates(ProductionStage.FABRIC_CHECKING, companyId, actor, [
        { code: WASTAGE_CODES.FW, quantityKg: input.fwKg },
        { code: WASTAGE_CODES.BW, quantityKg: input.bwKg, colorId: input.colorId },
    ]);

    const record = await prisma.productionRecord.create({
        data: {
            companyId,
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
                    // pieceCount/firstGradeKg/secondGradeKg are no longer
                    // collected via the entry UI — the columns stay NOT NULL,
                    // so default to 0 rather than leave the create() incomplete.
                    pieceCount: input.pieceCount ?? 0,
                    firstGradeKg: input.firstGradeKg ?? 0,
                    secondGradeKg: input.secondGradeKg ?? 0,
                    outputKg: input.outputKg,
                },
            },
            ...(wastageCreates.length > 0 ? { wastages: { create: wastageCreates } } : {}),
        },
        select: fabricCheckingSelect,
    });

    return mapFabricCheckingRecord(record);
}

export async function listFabricCheckingRecords(query: ListFabricCheckingQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const where = buildProductionWhere(ProductionStage.FABRIC_CHECKING, query, companyId);

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

export async function getFabricCheckingRecordById(id: string, companyId: string) {
    const record = await prisma.productionRecord.findFirst({
        where: { id, companyId, stage: ProductionStage.FABRIC_CHECKING },
        select: fabricCheckingSelect,
    });
    if (!record) throw new NotFoundError('Fabric checking record not found', 'FABRIC_CHECKING_NOT_FOUND', { id });
    return mapFabricCheckingRecord(record);
}
