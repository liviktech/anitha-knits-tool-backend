import { ProductionStage } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ValidationError } from '../utils/errors.js';
import { getInventorySummaryByDateRange } from './inventoryService.js';
import { getLoadSentSummaryByDateRange } from './loadSentService.js';
import { getFabricProductionSummaryByDateRange } from './fabricCheckingService.js';
import { getWastageSummaryByDateRange } from './wastageService.js';
import type { DashboardMonthlyQuery, DashboardProductionQuery } from '../validations/dashboardValidation.js';


const MAX_RANGE_DAYS = 186;

type StageAggregate = {
    inputKg: number;
    outputKg: number;
    wastageKg: number;
    yarnWasteKg: number;
    lumpsKg: number;
    recordCount: number;
    approvedCount: number;
};
type StageTotals = Omit<StageAggregate, 'recordCount' | 'approvedCount'>;
type StageDaily = StageTotals & { wastePct: number; isApproved: boolean };
type StageSummary = StageTotals & { wastePct: number; efficiencyPct: number; isApproved: boolean };

const STAGE_KEYS = ['extruder', 'looms', 'fabricChecking'] as const;
type StageKey = (typeof STAGE_KEYS)[number];

function dateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function emptyAggregate(): StageAggregate {
    return { inputKg: 0, outputKg: 0, wastageKg: 0, yarnWasteKg: 0, lumpsKg: 0, recordCount: 0, approvedCount: 0 };
}

function toPublicTotals(aggregate: StageAggregate): StageTotals {
    const { recordCount: _recordCount, approvedCount: _approvedCount, ...totals } = aggregate;
    return totals;
}

function isAllApproved(aggregate: StageAggregate): boolean {
    return aggregate.recordCount > 0 && aggregate.approvedCount === aggregate.recordCount;
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function withWastePct(totals: StageAggregate): StageDaily {
    const publicTotals = toPublicTotals(totals);
    return {
        ...publicTotals,
        wastePct: publicTotals.inputKg > 0 ? round2((publicTotals.wastageKg / publicTotals.inputKg) * 100) : 0,
        isApproved: isAllApproved(totals),
    };
}

function withSummaryMetrics(totals: StageAggregate): StageSummary {
    const publicTotals = toPublicTotals(totals);
    return {
        ...publicTotals,
        wastePct: publicTotals.inputKg > 0 ? round2((publicTotals.wastageKg / publicTotals.inputKg) * 100) : 0,
        efficiencyPct: publicTotals.inputKg > 0 ? round2((publicTotals.outputKg / publicTotals.inputKg) * 100) : 0,
        isApproved: isAllApproved(totals),
    };
}

function resolveRange(query: DashboardProductionQuery): { dateFrom: Date; dateTo: Date } {
    if (query.date_from && query.date_to) {
        const spanDays = (query.date_to.getTime() - query.date_from.getTime()) / 86_400_000;
        if (spanDays > MAX_RANGE_DAYS) {
            throw new ValidationError(`date range must not exceed ${MAX_RANGE_DAYS} days`, 'DATE_RANGE_TOO_LARGE', {
                maxRangeDays: MAX_RANGE_DAYS,
            });
        }
        return { dateFrom: query.date_from, dateTo: query.date_to };
    }
    // Default to the current UTC calendar month â€” always well under MAX_RANGE_DAYS.
    const now = new Date();
    const dateFrom = query.date_from ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const dateTo = query.date_to ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return { dateFrom, dateTo };
}

/** Shared by getProductionDashboard (needs the day-wise breakdown) and getStageProductionSummaryByDateRange (totals only). */
async function computeStageTotals(
    companyId: string,
    dateFrom: Date,
    dateTo: Date,
): Promise<{ byDate: Map<string, Record<StageKey, StageAggregate>>; grandTotals: Record<StageKey, StageAggregate> }> {
    const productionDate = { gte: dateFrom, lte: dateTo };

    const [extruderRows, loomsRows, fabricRows, wastageRows] = await Promise.all([
        prisma.productionRecord.findMany({
            where: { companyId, stage: ProductionStage.EXTRUDER, productionDate },
            select: { productionDate: true, isApproved: true, extruder: { select: { rawMaterialKg: true, yarnOutputKg: true } } },
        }),
        prisma.productionRecord.findMany({
            where: { companyId, stage: ProductionStage.LOOMS, productionDate },
            select: { productionDate: true, isApproved: true, loom: { select: { yarnInputKg: true, fabricOutputKg: true } } },
        }),
        prisma.productionRecord.findMany({
            where: { companyId, stage: ProductionStage.FABRIC_CHECKING, productionDate },
            select: {
                productionDate: true,
                isApproved: true,
                fabricCheck: { select: { fabricInputKg: true, outputKg: true } },
            },
        }),
        prisma.wastageRecord.findMany({
            where: {
                companyId,
                productionRecord: {
                    productionDate,
                    stage: { in: [ProductionStage.EXTRUDER, ProductionStage.LOOMS, ProductionStage.FABRIC_CHECKING] },
                },
            },
            select: { quantityKg: true, wastageType: { select: { code: true } }, productionRecord: { select: { productionDate: true, stage: true } } },
        }),
    ]);

    const byDate = new Map<string, Record<StageKey, StageAggregate>>();

    function bucket(date: Date): Record<StageKey, StageAggregate> {
        const key = dateKey(date);
        let entry = byDate.get(key);
        if (!entry) {
            entry = {
                extruder: emptyAggregate(),
                looms: emptyAggregate(),
                fabricChecking: emptyAggregate(),
            };
            byDate.set(key, entry);
        }
        return entry;
    }

    for (const row of extruderRows) {
        if (!row.extruder) continue;
        const totals = bucket(row.productionDate).extruder;
        totals.inputKg += row.extruder.rawMaterialKg.toNumber();
        totals.outputKg += row.extruder.yarnOutputKg.toNumber();
        totals.recordCount += 1;
        totals.approvedCount += row.isApproved ? 1 : 0;
    }
    for (const row of loomsRows) {
        if (!row.loom) continue;
        const totals = bucket(row.productionDate).looms;
        totals.inputKg += row.loom.yarnInputKg.toNumber();
        totals.outputKg += row.loom.fabricOutputKg.toNumber();
        totals.recordCount += 1;
        totals.approvedCount += row.isApproved ? 1 : 0;
    }
    for (const row of fabricRows) {
        if (!row.fabricCheck) continue;
        const totals = bucket(row.productionDate).fabricChecking;
        totals.inputKg += row.fabricCheck.fabricInputKg.toNumber();
        // outputKg is the entry screen's single Final Stock/Output figure.
        totals.outputKg += row.fabricCheck.outputKg?.toNumber() ?? 0;
        totals.recordCount += 1;
        totals.approvedCount += row.isApproved ? 1 : 0;
    }
    const stageKeyByStage: Record<ProductionStage, StageKey | undefined> = {
        [ProductionStage.EXTRUDER]: 'extruder',
        [ProductionStage.LOOMS]: 'looms',
        [ProductionStage.FABRIC_CHECKING]: 'fabricChecking',
        [ProductionStage.DELIVERY]: undefined,
    };
    for (const row of wastageRows) {
        const key = stageKeyByStage[row.productionRecord.stage];
        if (!key) continue;
        const qty = row.quantityKg.toNumber();
        const stageTotals = bucket(row.productionRecord.productionDate)[key];
        stageTotals.wastageKg += qty;
        if (key === 'extruder') {
            if (row.wastageType.code === 'YARN_WASTE') {
                stageTotals.yarnWasteKg += qty;
            } else if (row.wastageType.code === 'LUMPS') {
                stageTotals.lumpsKg += qty;
            }
        }
    }

    const grandTotals: Record<StageKey, StageAggregate> = { extruder: emptyAggregate(), looms: emptyAggregate(), fabricChecking: emptyAggregate() };
    for (const stages of byDate.values()) {
        for (const key of STAGE_KEYS) {
            grandTotals[key].inputKg += stages[key].inputKg;
            grandTotals[key].outputKg += stages[key].outputKg;
            grandTotals[key].wastageKg += stages[key].wastageKg;
            grandTotals[key].yarnWasteKg += stages[key].yarnWasteKg;
            grandTotals[key].lumpsKg += stages[key].lumpsKg;
            grandTotals[key].recordCount += stages[key].recordCount;
            grandTotals[key].approvedCount += stages[key].approvedCount;
        }
    }

    return { byDate, grandTotals };
}

export async function getProductionDashboard(query: DashboardProductionQuery, companyId: string) {
    const { dateFrom, dateTo } = resolveRange(query);
    const { byDate, grandTotals } = await computeStageTotals(companyId, dateFrom, dateTo);

    const daily = [...byDate.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([date, stages]) => ({
            date,
            extruder: withWastePct(stages.extruder),
            looms: withWastePct(stages.looms),
            fabricChecking: withWastePct(stages.fabricChecking),
        }));

    return {
        range: { dateFrom: dateKey(dateFrom), dateTo: dateKey(dateTo) },
        summary: {
            extruder: withSummaryMetrics(grandTotals.extruder),
            looms: withSummaryMetrics(grandTotals.looms),
            fabricChecking: withSummaryMetrics(grandTotals.fabricChecking),
        },
        daily,
    };
}

/** Overall per-stage production totals (Extruder/Looms/Fabric Checking) for a date range â€” the monthly dashboard's "overall month production" section. */
export async function getStageProductionSummaryByDateRange(companyId: string, dateFrom: Date, dateTo: Date) {
    const { grandTotals } = await computeStageTotals(companyId, dateFrom, dateTo);
    return {
        extruder: withSummaryMetrics(grandTotals.extruder),
        looms: withSummaryMetrics(grandTotals.looms),
        fabricChecking: withSummaryMetrics(grandTotals.fabricChecking),
    };
}

/** Resolves a 1-indexed month + a year into that calendar month's UTC date span, defaulting to the current month. */
function resolveMonthRange(query: DashboardMonthlyQuery): { month: number; year: number; dateFrom: Date; dateTo: Date } {
    const now = new Date();
    const year = query.year ?? now.getUTCFullYear();
    const month = query.month ?? now.getUTCMonth() + 1;
    const dateFrom = new Date(Date.UTC(year, month - 1, 1));
    const dateTo = new Date(Date.UTC(year, month, 0));
    return { month, year, dateFrom, dateTo };
}

/**
 * Backs the monthly management dashboard (GET /api/v1/dashboard): inventory
 * on hand (HDPE/chemical/colour), stock delivered (Load Sent), fabric
 * production (variant-wise colour+size, plus overall), overall production
 * totals across all three stages (Extruder/Looms/Fabric Checking), and
 * wastage across all 5 client-terminology categories â€” all scoped to one
 * calendar month. Each section is computed by a reusable per-domain function
 * shared with that domain's own list/summary endpoints.
 *
 * Time: O(n) â€” n = rows across the 5 underlying queries, run concurrently.
 */
export async function getMonthlyDashboard(query: DashboardMonthlyQuery, companyId: string) {
    const { month, year, dateFrom, dateTo } = resolveMonthRange(query);

    const [inventory, loadSent, fabricProduction, wastage, production, extruderProduction, loomsProduction, stockBalance] = await Promise.all([
        getInventorySummaryByDateRange(companyId, dateFrom, dateTo),
        getLoadSentSummaryByDateRange(companyId, dateFrom, dateTo),
        getFabricProductionSummaryByDateRange(companyId, dateFrom, dateTo),
        getWastageSummaryByDateRange(companyId, dateFrom, dateTo),
        getStageProductionSummaryByDateRange(companyId, dateFrom, dateTo),
        import('./extruderService.js').then(m => m.getExtruderProductionSummaryByDateRange(companyId, dateFrom, dateTo)),
        import('./loomsService.js').then(m => m.getLoomsProductionSummaryByDateRange(companyId, dateFrom, dateTo)),
        import('./loadSentService.js').then(m => m.getStockBalance(companyId)),
    ]);

    return {
        range: { month, year, dateFrom: dateKey(dateFrom), dateTo: dateKey(dateTo) },
        inventory,
        loadSent,
        fabricProduction,
        production,
        wastage,
        extruderProduction,
        loomsProduction,
        stockBalance,
    };
}

