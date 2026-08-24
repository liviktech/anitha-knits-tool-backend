import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { assertColorExists, assertSizeExists } from './masterDataService.js';
import type { CreateLoadSentInput, UpdateLoadSentInput, ListLoadSentQuery } from '../validations/loadSentValidation.js';

const loadSentSelect = {
    id: true,
    date: true,
    color: { select: { id: true, name: true } },
    size: { select: { id: true, name: true } },
    fabricWeight: true,
    fwWeight: true,
    bwWeight: true,
    totalWeightkg: true,
    createdAt: true,
    createdBy: true,
    updatedAt: true,
    updatedBy: true,
} satisfies Prisma.LoadSentSelect;

type LoadSentRow = Prisma.LoadSentGetPayload<{ select: typeof loadSentSelect }>;

function mapLoadSentRecord(record: LoadSentRow) {
    return {
        ...record,
        fabricWeight: record.fabricWeight.toNumber(),
        fwWeight: record.fwWeight.toNumber(),
        bwWeight: record.bwWeight.toNumber(),
        totalWeightkg: record.totalWeightkg.toNumber(),
    };
}

export async function createLoadSent(input: CreateLoadSentInput, companyId: string, actor: string) {
    await Promise.all([assertColorExists(input.colorId, companyId), assertSizeExists(input.sizeId, companyId)]);

    const fabricWeight = input.fabricWeight ?? 0;
    const fwWeight = input.fwWeight ?? 0;
    const bwWeight = input.bwWeight ?? 0;
    const totalWeightkg = fabricWeight + fwWeight + bwWeight;

    const record = await prisma.loadSent.create({
        data: {
            companyId,
            date: input.date,
            colorId: input.colorId,
            sizeId: input.sizeId,
            fabricWeight,
            fwWeight,
            bwWeight,
            totalWeightkg,
            createdBy: actor,
        },
        select: loadSentSelect,
    });

    return mapLoadSentRecord(record);
}

export async function listLoadSent(query: ListLoadSentQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);

    const where: Prisma.LoadSentWhereInput = {
        companyId,
        ...(query.date_from || query.date_to
            ? {
                sentDate: {
                    ...(query.date_from ? { gte: query.date_from } : {}),
                    ...(query.date_to ? { lte: query.date_to } : {}),
                },
            }
            : {}),
        ...(query.color_id ? { colorId: query.color_id } : {}),
        ...(query.size_id ? { sizeId: query.size_id } : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.loadSent.findMany({
            where,
            select: loadSentSelect,
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            skip,
            take,
        }),
        prisma.loadSent.count({ where }),
    ]);

    return { items: rows.map(mapLoadSentRecord), meta: toPageMeta(query, total) };
}

export async function getLoadSentById(id: string, companyId: string) {
    const record = await prisma.loadSent.findFirst({ where: { id, companyId }, select: loadSentSelect });
    if (!record) throw new NotFoundError('Load Sent record not found', 'LOAD_SENT_NOT_FOUND', { id });
    return mapLoadSentRecord(record);
}

export async function updateLoadSent(id: string, input: UpdateLoadSentInput, companyId: string, actor: string) {
    const existing = await prisma.loadSent.findFirst({
        where: { id, companyId },
        select: { id: true, fabricWeight: true, fwWeight: true, bwWeight: true },
    });
    if (!existing) throw new NotFoundError('Load Sent record not found', 'LOAD_SENT_NOT_FOUND', { id });

    await Promise.all([
        input.colorId ? assertColorExists(input.colorId, companyId) : undefined,
        input.sizeId ? assertSizeExists(input.sizeId, companyId) : undefined,
    ]);

    const fabricWeight = input.fabricWeight !== undefined ? input.fabricWeight : existing.fabricWeight.toNumber();
    const fwWeight = input.fwWeight !== undefined ? input.fwWeight : existing.fwWeight.toNumber();
    const bwWeight = input.bwWeight !== undefined ? input.bwWeight : existing.bwWeight.toNumber();
    const totalWeightkg = fabricWeight + fwWeight + bwWeight;

    const record = await prisma.loadSent.update({
        where: { id },
        data: {
            ...(input.date !== undefined ? { sentDate: input.date } : {}),
            ...(input.colorId !== undefined ? { colorId: input.colorId } : {}),
            ...(input.sizeId !== undefined ? { sizeId: input.sizeId } : {}),
            fabricWeight,
            fwWeight,
            bwWeight,
            totalWeightkg,
            updatedBy: actor,
        },
        select: loadSentSelect,
    });

    return mapLoadSentRecord(record);
}

export async function deleteLoadSent(id: string, companyId: string) {
    const existing = await prisma.loadSent.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!existing) throw new NotFoundError('Load Sent record not found', 'LOAD_SENT_NOT_FOUND', { id });

    await prisma.loadSent.delete({ where: { id } });
}

export async function getStockBalance(companyId: string) {
    const fabricCheckingRows = await prisma.productionRecord.findMany({
        where: { companyId, stage: 'FABRIC_CHECKING' },
        select: {
            colorId: true,
            color: { select: { id: true, name: true } },
            sizeId: true,
            size: { select: { id: true, name: true } },
            fabricCheck: {
                select: {
                    outputKg: true,
                },
            },
        },
    });

    const wastageRows = await prisma.wastageRecord.findMany({
        where: {
            companyId,
            productionRecord: { stage: 'FABRIC_CHECKING' },
        },
        select: {
            quantityKg: true,
            wastageType: { select: { code: true } },
            productionRecord: {
                select: {
                    colorId: true,
                    color: { select: { id: true, name: true } },
                    sizeId: true,
                    size: { select: { id: true, name: true } },
                },
            },
        },
    });

    const loadSentRows = await prisma.loadSent.findMany({
        where: { companyId },
        select: {
            colorId: true,
            color: { select: { id: true, name: true } },
            sizeId: true,
            size: { select: { id: true, name: true } },
            fabricWeight: true,
            fwWeight: true,
            bwWeight: true,
        },
    });

    const stockMap = new Map<
        string,
        {
            color: { id: string; name: string };
            size: { id: string; name: string };
            fabricCheckingOutputKg: number;
            loadSentFabricWeightKg: number;
            availableFabricStockKg: number;
            wastageFwGeneratedKg: number;
            loadSentFwWeightKg: number;
            availableFwStockKg: number;
            wastageBwGeneratedKg: number;
            loadSentBwWeightKg: number;
            availableBwStockKg: number;
        }
    >();

    function getOrCreate(
        colorId: string,
        sizeId: string,
        color: { id: string; name: string },
        size: { id: string; name: string },
    ) {
        const key = `${colorId}_${sizeId}`;
        if (!stockMap.has(key)) {
            stockMap.set(key, {
                color,
                size,
                fabricCheckingOutputKg: 0,
                loadSentFabricWeightKg: 0,
                availableFabricStockKg: 0,
                wastageFwGeneratedKg: 0,
                loadSentFwWeightKg: 0,
                availableFwStockKg: 0,
                wastageBwGeneratedKg: 0,
                loadSentBwWeightKg: 0,
                availableBwStockKg: 0,
            });
        }
        return stockMap.get(key)!;
    }

    for (const row of fabricCheckingRows) {
        if (!row.color || !row.size) continue;
        const entry = getOrCreate(row.colorId, row.sizeId, row.color, row.size);
        const output = row.fabricCheck?.outputKg ? row.fabricCheck.outputKg.toNumber() : 0;
        entry.fabricCheckingOutputKg += output;
    }

    for (const row of wastageRows) {
        if (!row.productionRecord || !row.productionRecord.color || !row.productionRecord.size) continue;
        const pRecord = row.productionRecord;
        const entry = getOrCreate(pRecord.colorId, pRecord.sizeId, pRecord.color, pRecord.size);
        const qty = row.quantityKg.toNumber();
        if (row.wastageType.code === 'FW') {
            entry.wastageFwGeneratedKg += qty;
        } else if (row.wastageType.code === 'BW') {
            entry.wastageBwGeneratedKg += qty;
        }
    }

    for (const row of loadSentRows) {
        if (!row.color || !row.size) continue;
        const entry = getOrCreate(row.colorId, row.sizeId, row.color, row.size);
        entry.loadSentFabricWeightKg += row.fabricWeight.toNumber();
        entry.loadSentFwWeightKg += row.fwWeight.toNumber();
        entry.loadSentBwWeightKg += row.bwWeight.toNumber();
    }

    const items = Array.from(stockMap.values()).map((entry) => {
        entry.availableFabricStockKg = entry.fabricCheckingOutputKg - entry.loadSentFabricWeightKg;
        entry.availableFwStockKg = entry.wastageFwGeneratedKg - entry.loadSentFwWeightKg;
        entry.availableBwStockKg = entry.wastageBwGeneratedKg - entry.loadSentBwWeightKg;
        return entry;
    });

    return items;
}
