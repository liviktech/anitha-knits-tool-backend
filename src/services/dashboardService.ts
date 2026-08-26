import { ProductionStage } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ValidationError } from '../utils/errors.js';
import { getInventorySummaryByDateRange } from './inventoryService.js';
import { getLoadSentSummaryByDateRange } from './loadSentService.js';
import { getFabricProductionSummaryByDateRange } from './fabricCheckingService.js';
import { getWastageSummaryByDateRange } from './wastageService.js';
import type { DashboardMonthlyQuery, DashboardProductionQuery } from '../validations/dashboardValidation.js';

/**
 * Backs the "Daily Production & Wastage" dashboard (PRD §16.10, GET
 * /api/v1/dashboard/production): per-stage totals for the summary cards, plus
 * a day-wise breakdown across all three production stages for the table.
 *
 * Wastage is summed from WastageRecord entries linked to each stage's
 * production records — it is intentionally NOT derived from input minus
 * output. For Extruder specifically that subtraction would be wrong: chemical
 * and colour mass is ADDED during extrusion, so yarnOutputKg can legitimately
 * exceed rawMaterialKg, and treating the gap as "wastage" would misrepresent
 * the process and invent a business rule the PRD never defines. The Wastage
 * API isn't built yet, so wastage/wastePct currently read 0 for every stage —
 * that's the correct reflection of what's actually been recorded, not a bug,
 * and it will start reflecting real data automatically once that API lands.
 *
 * Time: O(n + d) where n = matching production/wastage rows in the date
 * range, d = distinct days with activity. Space: O(d).
 */
const MAX_RANGE_DAYS = 186;

type StageTotals = { inputKg: number; outputKg: number; wastageKg: number };
type StageDaily = StageTotals & { wastePct: number };
type StageSummary = StageTotals & { wastePct: number; efficiencyPct: number };

const STAGE_KEYS = ['extruder', 'looms', 'fabricChecking'] as const;
type StageKey = (typeof STAGE_KEYS)[number];

function dateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function emptyTotals(): StageTotals {
    return { inputKg: 0, outputKg: 0, wastageKg: 0 };
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function withWastePct(totals: StageTotals): StageDaily {
    return { ...totals, wastePct: totals.inputKg > 0 ? round2((totals.wastageKg / totals.inputKg) * 100) : 0 };
}

function withSummaryMetrics(totals: StageTotals): StageSummary {
    return {
        ...totals,
        wastePct: totals.inputKg > 0 ? round2((totals.wastageKg / totals.inputKg) * 100) : 0,
        efficiencyPct: totals.inputKg > 0 ? round2((totals.outputKg / totals.inputKg) * 100) : 0,
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
    // Default to the current UTC calendar month — always well under MAX_RANGE_DAYS.
    const now = new Date();
    const dateFrom = query.date_from ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const dateTo = query.date_to ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return { dateFrom, dateTo };
}

export async function getProductionDashboard(query: DashboardProductionQuery, companyId: string) {
    const { dateFrom, dateTo } = resolveRange(query);
    const productionDate = { gte: dateFrom, lte: dateTo };

    const [extruderRows, loomsRows, fabricRows, wastageRows] = await Promise.all([
        prisma.productionRecord.findMany({
            where: { companyId, stage: ProductionStage.EXTRUDER, productionDate },
            select: { productionDate: true, extruder: { select: { rawMaterialKg: true, yarnOutputKg: true } } },
        }),
        prisma.productionRecord.findMany({
            where: { companyId, stage: ProductionStage.LOOMS, productionDate },
            select: { productionDate: true, loom: { select: { yarnInputKg: true, fabricOutputKg: true } } },
        }),
        prisma.productionRecord.findMany({
            where: { companyId, stage: ProductionStage.FABRIC_CHECKING, productionDate },
            select: {
                productionDate: true,
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
            select: { quantityKg: true, productionRecord: { select: { productionDate: true, stage: true } } },
        }),
    ]);

    const byDate = new Map<string, Record<StageKey, StageTotals>>();

    function bucket(date: Date): Record<StageKey, StageTotals> {
        const key = dateKey(date);
        let entry = byDate.get(key);
        if (!entry) {
            entry = { extruder: emptyTotals(), looms: emptyTotals(), fabricChecking: emptyTotals() };
            byDate.set(key, entry);
        }
        return entry;
    }

    for (const row of extruderRows) {
        if (!row.extruder) continue;
        const totals = bucket(row.productionDate).extruder;
        totals.inputKg += row.extruder.rawMaterialKg.toNumber();
        totals.outputKg += row.extruder.yarnOutputKg.toNumber();
    }
    for (const row of loomsRows) {
        if (!row.loom) continue;
        const totals = bucket(row.productionDate).looms;
        totals.inputKg += row.loom.yarnInputKg.toNumber();
        totals.outputKg += row.loom.fabricOutputKg.toNumber();
    }
    for (const row of fabricRows) {
        if (!row.fabricCheck) continue;
        const totals = bucket(row.productionDate).fabricChecking;
        totals.inputKg += row.fabricCheck.fabricInputKg.toNumber();
        // outputKg is the entry screen's single Final Stock/Output figure.
        totals.outputKg += row.fabricCheck.outputKg?.toNumber() ?? 0;
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
        bucket(row.productionRecord.productionDate)[key].wastageKg += row.quantityKg.toNumber();
    }

    const daily = [...byDate.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([date, stages]) => ({
            date,
            extruder: withWastePct(stages.extruder),
            looms: withWastePct(stages.looms),
            fabricChecking: withWastePct(stages.fabricChecking),
        }));

    const grandTotals: Record<StageKey, StageTotals> = { extruder: emptyTotals(), looms: emptyTotals(), fabricChecking: emptyTotals() };
    for (const stages of byDate.values()) {
        for (const key of STAGE_KEYS) {
            grandTotals[key].inputKg += stages[key].inputKg;
            grandTotals[key].outputKg += stages[key].outputKg;
            grandTotals[key].wastageKg += stages[key].wastageKg;
        }
    }

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
 * production (variant-wise colour+size, plus overall), and wastage across
 * all 5 client-terminology categories — all scoped to one calendar month.
 * Each section is computed by a reusable per-domain function shared with
 * that domain's own list/summary endpoints.
 *
 * Time: O(n) — n = rows across the 4 underlying queries, run concurrently.
 */
export async function getMonthlyDashboard(query: DashboardMonthlyQuery, companyId: string) {
    const { month, year, dateFrom, dateTo } = resolveMonthRange(query);

    const [inventory, loadSent, fabricProduction, wastage] = await Promise.all([
        getInventorySummaryByDateRange(companyId, dateFrom, dateTo),
        getLoadSentSummaryByDateRange(companyId, dateFrom, dateTo),
        getFabricProductionSummaryByDateRange(companyId, dateFrom, dateTo),
        getWastageSummaryByDateRange(companyId, dateFrom, dateTo),
    ]);

    return {
        range: { month, year, dateFrom: dateKey(dateFrom), dateTo: dateKey(dateTo) },
        inventory,
        loadSent,
        fabricProduction,
        wastage,
    };
}
