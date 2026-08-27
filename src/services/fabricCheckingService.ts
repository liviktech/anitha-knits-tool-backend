import { Prisma, ProductionStage } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { roundKg } from '../utils/decimal.js';
import { buildProductionWhere } from '../utils/productionFilters.js';
import { assertColorExists, assertSizeExists } from './masterDataService.js';
import { buildWastageCreates, mapWastageRecord, wastageSelect } from './wastageService.js';
import { WASTAGE_CODES } from '../constants/wastageCodes.js';
import { debitKoraBalance } from './koraBalanceService.js';
import type { CreateFabricCheckingInput, UpdateFabricCheckingInput, ListFabricCheckingQuery } from '../validations/fabricCheckingValidation.js';

/**
 * Fabric Checking is PRD §16.7 (base path /api/v1/fabric-checking, not nested
 * under /production/): create/list/get, no approval workflow — records are
 * created directly and are immediately final.
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
const fabricCheckingSelect = {
    id: true,
    stage: true,
    productionDate: true,
    remarks: true,
    color: { select: { id: true, name: true } },
    size: { select: { id: true, name: true } },
    fabricCheck: {
        select: {
            fabricInputKg: true,
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

    const record = await prisma.$transaction(async (tx) => {
        const created = await tx.productionRecord.create({
            data: {
                companyId,
                stage: ProductionStage.FABRIC_CHECKING,
                productionDate: input.productionDate,
                colorId: input.colorId,
                sizeId: input.sizeId,
                remarks: input.remarks,
                createdBy: actor,
                fabricCheck: {
                    create: {
                        fabricInputKg: input.fabricInputKg,
                        outputKg: input.outputKg,
                    },
                },
                ...(wastageCreates.length > 0 ? { wastages: { create: wastageCreates } } : {}),
            },
            select: fabricCheckingSelect,
        });

        // Debit kora balance with the fabric input consumed
        await debitKoraBalance(
            input.colorId,
            input.sizeId,
            input.fabricInputKg,
            input.productionDate,
            created.id,
            actor,
            tx,
        );

        return created;
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

export async function updateFabricCheckingRecord(id: string, input: UpdateFabricCheckingInput, companyId: string, actor: string) {
    const existing = await prisma.productionRecord.findFirst({
        where: { id, companyId, stage: ProductionStage.FABRIC_CHECKING },
        select: { id: true },
    });
    if (!existing) throw new NotFoundError('Fabric checking record not found', 'FABRIC_CHECKING_NOT_FOUND', { id });

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

        await tx.fabricCheckDetail.update({
            where: { productionRecordId: id },
            data: {
                ...(input.fabricInputKg !== undefined ? { fabricInputKg: input.fabricInputKg } : {}),
            },
        });

        return tx.productionRecord.findUniqueOrThrow({ where: { id }, select: fabricCheckingSelect });
    });

    return mapFabricCheckingRecord(updated);
}

export type FabricProductionVariantSummary = {
    color: { id: string; name: string };
    size: { id: string; name: string };
    fabricInputKg: number;
    outputKg: number;
};

export type FabricProductionColorSummary = {
    color: { id: string; name: string };
    production: number;
    fwWasteKg: number;
    bwWasteKg: number;
    total: number;
};

export type FabricProductionSummary = {
    byVariant: FabricProductionVariantSummary[];
    byColor: FabricProductionColorSummary[];
    overall: { fabricInputKg: number; outputKg: number };
};

/**
 * Fabric Checking output for a date range, broken down by colour+size
 * variant, by colour alone (with FW/BW wastage), plus an overall total —
 * backs the dashboard's monthly "fabric production" panel.
 *
 * Time: O(n) — n = Fabric Checking records in the range (one query, one pass).
 */
export async function getFabricProductionSummaryByDateRange(
    companyId: string,
    dateFrom: Date,
    dateTo: Date,
): Promise<FabricProductionSummary> {
    const rows = await prisma.productionRecord.findMany({
        where: { companyId, stage: ProductionStage.FABRIC_CHECKING, productionDate: { gte: dateFrom, lte: dateTo } },
        select: {
            color: { select: { id: true, name: true } },
            size: { select: { id: true, name: true } },
            fabricCheck: { select: { fabricInputKg: true, outputKg: true } },
            wastages: { select: { quantityKg: true, wastageType: { select: { code: true } } } },
        },
    });

    const byVariantMap = new Map<string, FabricProductionVariantSummary>();
    const byColorMap = new Map<string, FabricProductionColorSummary>();
    const overall = { fabricInputKg: 0, outputKg: 0 };

    for (const row of rows) {
        if (!row.fabricCheck) continue;
        const inputKg = row.fabricCheck.fabricInputKg.toNumber();
        const outputKg = row.fabricCheck.outputKg ? row.fabricCheck.outputKg.toNumber() : 0;

        overall.fabricInputKg += inputKg;
        overall.outputKg += outputKg;

        const variantKey = `${row.color.id}_${row.size.id}`;
        let variantEntry = byVariantMap.get(variantKey);
        if (!variantEntry) {
            variantEntry = { color: row.color, size: row.size, fabricInputKg: 0, outputKg: 0 };
            byVariantMap.set(variantKey, variantEntry);
        }
        variantEntry.fabricInputKg += inputKg;
        variantEntry.outputKg += outputKg;

        let colorEntry = byColorMap.get(row.color.id);
        if (!colorEntry) {
            colorEntry = { color: row.color, production: 0, fwWasteKg: 0, bwWasteKg: 0, total: 0 };
            byColorMap.set(row.color.id, colorEntry);
        }
        colorEntry.production += outputKg;
        for (const w of row.wastages) {
            if (w.wastageType.code === WASTAGE_CODES.FW) colorEntry.fwWasteKg += w.quantityKg.toNumber();
            else if (w.wastageType.code === WASTAGE_CODES.BW) colorEntry.bwWasteKg += w.quantityKg.toNumber();
        }
    }

    return {
        byVariant: Array.from(byVariantMap.values()).map((entry) => ({
            ...entry,
            fabricInputKg: roundKg(entry.fabricInputKg),
            outputKg: roundKg(entry.outputKg),
        })),
        byColor: Array.from(byColorMap.values()).map((entry) => ({
            ...entry,
            production: roundKg(entry.production),
            fwWasteKg: roundKg(entry.fwWasteKg),
            bwWasteKg: roundKg(entry.bwWasteKg),
            total: roundKg(entry.production + entry.fwWasteKg + entry.bwWasteKg),
        })),
        overall: { fabricInputKg: roundKg(overall.fabricInputKg), outputKg: roundKg(overall.outputKg) },
    };
}

export async function deleteFabricCheckingRecord(id: string, companyId: string): Promise<void> {
    const existing = await prisma.productionRecord.findFirst({
        where: { id, companyId, stage: ProductionStage.FABRIC_CHECKING },
        select: { id: true },
    });
    if (!existing) throw new NotFoundError('Fabric checking record not found', 'FABRIC_CHECKING_NOT_FOUND', { id });

    await prisma.$transaction(async (tx) => {
        // WastageRecord has no onDelete: Cascade to ProductionRecord, so it
        // must be cleared explicitly before the record itself can be deleted.
        await tx.wastageRecord.deleteMany({ where: { productionRecordId: id } });
        await tx.productionRecord.delete({ where: { id } });
    });
}