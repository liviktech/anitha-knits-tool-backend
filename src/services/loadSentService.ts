import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { roundKg } from '../utils/decimal.js';
import { assertColorExists, assertSizeExists } from './masterDataService.js';
import type { CreateLoadSentInput, UpdateLoadSentInput, ListLoadSentQuery } from '../validations/loadSentValidation.js';

const loadSentSelect = {
    id: true,

    stage: true,

    productionDate: true,

    remarks: true,

    color: {
        select: {
            id: true,
            name: true,
        },
    },

    size: {
        select: {
            id: true,
            name: true,
        },
    },

    loadSent: {
        select: {
            fabricWeight: true,
            fwWeight: true,
            bwWeight: true,
            totalWastageWeight: true,
            driverName: true,
            vehicleNo: true,
        },
    },

    createdAt: true,
    createdBy: true,
    updatedAt: true,
    updatedBy: true,
} satisfies Prisma.LoadSentSelect;

type LoadSentRow = Prisma.LoadSentGetPayload<{ select: typeof loadSentSelect }>;

function mapLoadSentRecord(record: LoadSentRow) {
    return {
        ...rest,

        loadSent: loadSent
            ? {
                fabricWeight: loadSent.fabricWeight.toNumber(),
                fwWeight: loadSent.fwWeight.toNumber(),
                bwWeight: loadSent.bwWeight.toNumber(),
                totalWastageWeight:
                    loadSent.totalWastageWeight.toNumber(),
                driverName: loadSent.driverName,
                vehicleNo: loadSent.vehicleNo,
            }
            : null,
    };
}

export async function createLoadSent(input: CreateLoadSentInput, companyId: string, actor: string) {
    await Promise.all([assertColorExists(input.colorId, companyId), assertSizeExists(input.sizeId, companyId)]);

    const fabricWeight = input.fabricWeight ?? 0;
    const fwWeight = input.fwWeight ?? 0;
    const bwWeight = input.bwWeight ?? 0;
    const totalWastageWeight = fwWeight + bwWeight;

    const record = await prisma.loadSent.create({
        data: {
            companyId,
        ),

        assertSizeExists(
            input.sizeId,
            companyId,
        ),
    ]);

    const record =
        await prisma.productionRecord.create({
            data: {
                companyId,

                stage:
                    ProductionStage.DELIVERY,

                productionDate:
                    input.productionDate,

                colorId:
                    input.colorId,

                sizeId:
                    input.sizeId,

                createdBy:
                    actor,

                loadSent: {
                    create: {
                        company: {
                            connect: {
                                id: companyId,
                            },
                        },
                        color: {
                            connect: {
                                id: input.colorId,
                            },
                        },
                        size: {
                            connect: {
                                id: input.sizeId,
                            },
                        },
                        fabricWeight: input.fabricWeight,
                        driverName: input.driverName,
                        vehicleNo: input.vehicleNo,
                        createdBy: actor,
                    },
                },
            },

            select:
                loadSentSelect,
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

export async function updateLoadSent(
    id: string,
    input: UpdateLoadSentInput,
    companyId: string,
    actor: string,
) {
    const existing =
        await prisma.productionRecord.findFirst({
            where: {
                id,
                companyId,
                stage: ProductionStage.DELIVERY,
                loadSent: {
                    isNot: null,
                },
            },

            select: {
                id: true,
                productionDate: true,
                colorId: true,
                sizeId: true,

                loadSent: {
                    select: {
                        fabricWeight: true,
                        fwWeight: true,
                        bwWeight: true,
                        driverName: true,
                        vehicleNo: true,
                    },
                },
            },
        });

    if (!existing || !existing.loadSent) {
        throw new NotFoundError(
            'Load Sent record not found',
            'LOAD_SENT_NOT_FOUND',
            { id },
        );
    }

    // Validate new master-data IDs if supplied
    await Promise.all([
        input.colorId ? assertColorExists(input.colorId, companyId) : undefined,
        input.sizeId ? assertSizeExists(input.sizeId, companyId) : undefined,
    ]);

    const fabricWeight = input.fabricWeight !== undefined ? input.fabricWeight : existing.fabricWeight.toNumber();
    const fwWeight = input.fwWeight !== undefined ? input.fwWeight : existing.fwWeight.toNumber();
    const bwWeight = input.bwWeight !== undefined ? input.bwWeight : existing.bwWeight.toNumber();
    const totalWastageWeight = fwWeight + bwWeight;

    const driverName =
        input.driverName !== undefined
            ? input.driverName
            : existing.loadSent.driverName;

    const vehicleNo =
        input.vehicleNo !== undefined
            ? input.vehicleNo
            : existing.loadSent.vehicleNo;

    const record =
        await prisma.productionRecord.update({
            where: {
                id,
            },

            data: {
                ...(input.productionDate !== undefined
                    ? {
                        productionDate:
                            input.productionDate,
                    }
                    : {}),

                ...(input.colorId !== undefined
                    ? {
                        color: {
                            connect: {
                                id: input.colorId,
                            },
                        },
                    }
                    : {}),

                ...(input.sizeId !== undefined
                    ? {
                        size: {
                            connect: {
                                id: input.sizeId,
                            },
                        },
                    }
                    : {}),

                updatedBy: actor,

                loadSent: {
                    update: {
                        fabricWeight,
                        fwWeight,
                        bwWeight,
                        totalWastageWeight,
                        driverName,
                        vehicleNo,
                        updatedBy: actor,
                    },
                },
            },

            select: loadSentSelect,
        });

    return mapLoadSentRecord(record);
}

export async function deleteLoadSent(
    id: string,
    companyId: string,
) {
    const existing =
        await prisma.productionRecord.findFirst({
            where: {
                id,
                companyId,
                stage: ProductionStage.DELIVERY,
                loadSent: {
                    isNot: null,
                },
            },
            select: {
                id: true,
            },
        });

    if (!existing) {
        throw new NotFoundError(
            'Load Sent record not found',
            'LOAD_SENT_NOT_FOUND',
            { id },
        );
    }

    await prisma.productionRecord.delete({
        where: {
            id,
        },
    });
}

export type LoadSentVariantSummary = {
    color: { id: string; name: string };
    size: { id: string; name: string };
    fabricWeightKg: number;
    fwWeightKg: number;
    bwWeightKg: number;
    totalWastageWeightKg: number;
};

export type LoadSentSummary = {
    items: ReturnType<typeof mapLoadSentRecord>[];
    totals: { fabricWeightKg: number; fwWeightKg: number; bwWeightKg: number; totalWastageWeightKg: number };
    byVariant: LoadSentVariantSummary[];
    daily?: { date: string; quantityKg: number }[];
};

/**
 * Load Sent ("stock delivered") records for a date range, with grand totals
 * and a per colour+size breakdown — backs the dashboard's monthly Load Sent
 * panel. Filters on productionDate (like listLoadSent), just unpaginated.
 *
 * Time: O(n) — n = Load Sent records in the range (one query, one pass).
 */
export async function getLoadSentSummaryByDateRange(
    companyId: string,
    dateFrom: Date,
    dateTo: Date,
): Promise<LoadSentSummary> {
    const rows = await prisma.productionRecord.findMany({
        where: {
            companyId,
            stage: ProductionStage.DELIVERY,
            productionDate: { gte: dateFrom, lte: dateTo },
            loadSent: { isNot: null },
        },
        select: loadSentSelect,
        orderBy: [{ productionDate: 'desc' }, { createdAt: 'desc' }],
    });

    const items = rows.map(mapLoadSentRecord);

    const totals = { fabricWeightKg: 0, fwWeightKg: 0, bwWeightKg: 0, totalWastageWeightKg: 0 };
    const byVariantMap = new Map<string, LoadSentVariantSummary>();
    const dailyMap = new Map<string, number>();

    for (const item of items) {
        if (!item.loadSent) continue;
        totals.fabricWeightKg += item.loadSent.fabricWeight;
        totals.fwWeightKg += item.loadSent.fwWeight;
        totals.bwWeightKg += item.loadSent.bwWeight;
        totals.totalWastageWeightKg += item.loadSent.totalWastageWeight;

        const key = `${item.color.id}_${item.size.id}`;
        let entry = byVariantMap.get(key);
        if (!entry) {
            entry = { color: item.color, size: item.size, fabricWeightKg: 0, fwWeightKg: 0, bwWeightKg: 0, totalWastageWeightKg: 0 };
            byVariantMap.set(key, entry);
        }
        entry.fabricWeightKg += item.loadSent.fabricWeight;
        entry.fwWeightKg += item.loadSent.fwWeight;
        entry.bwWeightKg += item.loadSent.bwWeight;
        entry.totalWastageWeightKg += item.loadSent.totalWastageWeight;

        const dateStr = item.productionDate.toISOString().slice(0, 10);
        dailyMap.set(dateStr, (dailyMap.get(dateStr) ?? 0) + item.loadSent.fabricWeight);
    }

    return {
        items,
        totals: {
            fabricWeightKg: roundKg(totals.fabricWeightKg),
            fwWeightKg: roundKg(totals.fwWeightKg),
            bwWeightKg: roundKg(totals.bwWeightKg),
            totalWastageWeightKg: roundKg(totals.totalWastageWeightKg),
        },
        byVariant: Array.from(byVariantMap.values()).map((entry) => ({
            ...entry,
            fabricWeightKg: roundKg(entry.fabricWeightKg),
            fwWeightKg: roundKg(entry.fwWeightKg),
            bwWeightKg: roundKg(entry.bwWeightKg),
            totalWastageWeightKg: roundKg(entry.totalWastageWeightKg),
        })),
        daily: Array.from(dailyMap.entries()).map(([date, quantityKg]) => ({
            date,
            quantityKg: roundKg(quantityKg),
        })).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    };
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
