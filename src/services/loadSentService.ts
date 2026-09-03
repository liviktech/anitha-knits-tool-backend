import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { roundKg } from '../utils/decimal.js';
import { formatDateOnly } from '../utils/dateOnly.js';
import { assertColorExists, assertSizeExists } from './masterDataService.js';
import type { CreateLoadSentInput, UpdateLoadSentInput, ListLoadSentQuery } from '../validations/loadSentValidation.js';
import {
    createLoadSent as createLoadSentRepo,
    deleteLoadSent as deleteLoadSentRepo,
    findFabricCheckingRowsForStock,
    findLoadSentExisting,
    findLoadSentRowsForStock,
    findLoadSentRowsForSummary,
    findWastageRowsForStock,
    getLoadSentById as getLoadSentByIdRepo,
    listLoadSent as listLoadSentRepo,
    updateLoadSent as updateLoadSentRepo,
    type LoadSentRecordRow,
} from '../repositories/loadSent.repository.js';

function mapLoadSentRecord(record: LoadSentRecordRow) {
    return record;
}

export async function createLoadSent(input: CreateLoadSentInput, companyId: string, actor: string) {
    await Promise.all([assertColorExists(input.colorId, companyId), assertSizeExists(input.sizeId, companyId)]);

    const record = await createLoadSentRepo({
        companyId,
        productionDate: input.date ?? new Date(),
        colorId: input.colorId,
        sizeId: input.sizeId,
        actor,
        fabricWeight: input.fabricWeight,
        driverName: input.driverName,
        vehicleNo: input.vehicleNo,
    });

    return mapLoadSentRecord(record);
}

export async function listLoadSent(query: ListLoadSentQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await listLoadSentRepo(
        { date_from: query.date_from, date_to: query.date_to, color_id: query.color_id, size: query.size_id },
        companyId,
        skip,
        take,
    );

    return { items: rows.map(mapLoadSentRecord), meta: toPageMeta(query, total) };
}

export async function getLoadSentById(id: string, companyId: string) {
    const record = await getLoadSentByIdRepo(id, companyId);
    if (!record) throw new NotFoundError('Load Sent record not found', 'LOAD_SENT_NOT_FOUND', { id });
    return mapLoadSentRecord(record);
}

export async function updateLoadSent(id: string, input: UpdateLoadSentInput, companyId: string, actor: string) {
    const existing = await findLoadSentExisting(id, companyId);
    if (!existing) throw new NotFoundError('Load Sent record not found', 'LOAD_SENT_NOT_FOUND', { id });

    // Validate new master-data IDs if supplied
    await Promise.all([
        input.colorId ? assertColorExists(input.colorId, companyId) : undefined,
        input.sizeId ? assertSizeExists(input.sizeId, companyId) : undefined,
    ]);

    const fabricWeight = input.fabricWeight !== undefined ? input.fabricWeight : existing.fabricWeight;
    const fwWeight = input.fwWeight !== undefined ? input.fwWeight : existing.fwWeight;
    const bwWeight = input.bwWeight !== undefined ? input.bwWeight : existing.bwWeight;
    const totalWastageWeight = fwWeight + bwWeight;
    const driverName = input.driverName !== undefined ? input.driverName : existing.driverName;
    const vehicleNo = input.vehicleNo !== undefined ? input.vehicleNo : existing.vehicleNo;

    const record = await updateLoadSentRepo(id, {
        productionDate: input.date,
        colorId: input.colorId,
        sizeId: input.sizeId,
        actor,
        fabricWeight,
        fwWeight,
        bwWeight,
        totalWastageWeight,
        driverName,
        vehicleNo,
    });

    return mapLoadSentRecord(record);
}

export async function deleteLoadSent(id: string, companyId: string) {
    const existing = await findLoadSentExisting(id, companyId);
    if (!existing) throw new NotFoundError('Load Sent record not found', 'LOAD_SENT_NOT_FOUND', { id });

    await deleteLoadSentRepo(id);
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
export async function getLoadSentSummaryByDateRange(companyId: string, dateFrom: Date, dateTo: Date): Promise<LoadSentSummary> {
    const rows = await findLoadSentRowsForSummary(companyId, dateFrom, dateTo);

    const items = rows.map((row) => ({
        id: row.id,
        color: { id: row.colorId, name: row.colorName },
        size: { id: row.sizeId, name: row.sizeName },
        productionDate: formatDateOnly(row.productionDate),
        loadSent: {
            fabricWeight: row.fabricWeight,
            fwWeight: row.fwWeight,
            bwWeight: row.bwWeight,
            totalWastageWeight: row.totalWastageWeight,
        },
    }));

    const totals = { fabricWeightKg: 0, fwWeightKg: 0, bwWeightKg: 0, totalWastageWeightKg: 0 };
    const byVariantMap = new Map<string, LoadSentVariantSummary>();
    const dailyMap = new Map<string, number>();

    for (const item of items) {
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

        const dateStr = item.productionDate;
        dailyMap.set(dateStr, (dailyMap.get(dateStr) ?? 0) + item.loadSent.fabricWeight);
    }

    return {
        items: items as unknown as ReturnType<typeof mapLoadSentRecord>[],
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
        daily: Array.from(dailyMap.entries())
            .map(([date, quantityKg]) => ({ date, quantityKg: roundKg(quantityKg) }))
            .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    };
}

export async function getStockBalance(companyId: string) {
    const [fabricCheckingRows, wastageRows, loadSentRows] = await Promise.all([
        findFabricCheckingRowsForStock(companyId),
        findWastageRowsForStock(companyId),
        findLoadSentRowsForStock(companyId),
    ]);

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

    function getOrCreate(colorId: string, sizeId: string, color: { id: string; name: string }, size: { id: string; name: string }) {
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
        const entry = getOrCreate(row.colorId, row.sizeId, { id: row.colorId, name: row.colorName }, { id: row.sizeId, name: row.sizeName });
        entry.fabricCheckingOutputKg += row.outputKg ?? 0;
    }

    for (const row of wastageRows) {
        const entry = getOrCreate(row.colorId, row.sizeId, { id: row.colorId, name: row.colorName }, { id: row.sizeId, name: row.sizeName });
        if (row.wastageTypeCode === 'FW') {
            entry.wastageFwGeneratedKg += row.quantityKg;
        } else if (row.wastageTypeCode === 'BW') {
            entry.wastageBwGeneratedKg += row.quantityKg;
        }
    }

    for (const row of loadSentRows) {
        const entry = getOrCreate(row.colorId, row.sizeId, { id: row.colorId, name: row.colorName }, { id: row.sizeId, name: row.sizeName });
        entry.loadSentFabricWeightKg += row.fabricWeight;
        entry.loadSentFwWeightKg += row.fwWeight;
        entry.loadSentBwWeightKg += row.bwWeight;
    }

    const items = Array.from(stockMap.values()).map((entry) => {
        entry.availableFabricStockKg = entry.fabricCheckingOutputKg - entry.loadSentFabricWeightKg;
        entry.availableFwStockKg = entry.wastageFwGeneratedKg - entry.loadSentFwWeightKg;
        entry.availableBwStockKg = entry.wastageBwGeneratedKg - entry.loadSentBwWeightKg;
        return entry;
    });

    return items;
}
