import type pg from 'pg';
import { NotFoundError } from '../utils/errors.js';
import { roundKg } from '../utils/decimal.js';
import { WASTAGE_CODES } from '../constants/wastageCodes.js';
import type { ProductionStage } from '../types/enums.js';
import {
    deleteWastageRecordById,
    findWastageRecordByTypeForProduction,
    findWastageRecordsForDateRange,
    findWastageType,
    findWastageTypesByCodes,
    insertWastageRecord,
    updateWastageRecord,
    type WastageRow,
} from '../repositories/wastage.repository.js';

/**
 * Wastage entered alongside a production record (PRD §9/§26: "Wastage must be
 * linked to a production record whenever applicable"). The dedicated Wastage
 * API (list/get/edit, PRD §16.6) isn't built yet, so this is the only way
 * wastage gets into WastageRecord today — created in the same transaction as
 * the production record, so it's atomic with it and always has a
 * productionRecordId.
 */

export function mapWastageRecord(row: WastageRow) {
    return row;
}

export type WastageEntryInput = {
    code: string;
    quantityKg: number | undefined;
    /** Only meaningful for colour-tracked types (e.g. BW / "B White", "B Blue"). */
    colorId?: string;
};

export interface WastageCreatePlan {
    wastageTypeId: string;
    colorId?: string;
    quantityKg: number;
    actor: string;
}

/**
 * Resolves (code, quantity) pairs into insert-ready wastage plans, looking up each WastageType's
 * id by (stage, code). Entries with an undefined or non-positive quantity are skipped entirely —
 * a WastageRecord is only created when a real positive quantity was supplied, so "no wastage of
 * this type" never produces a zero-quantity row. The caller inserts these rows itself (via
 * wastage.repository.insertWastageRecord) inside the same transaction as the production record.
 *
 * Time: O(k) — k = number of wastage entries for the stage (at most 2 today).
 */
export async function buildWastageCreates(
    stage: ProductionStage,
    companyId: string,
    actor: string,
    entries: WastageEntryInput[],
): Promise<WastageCreatePlan[]> {
    const withQuantity = entries.filter(
        (entry): entry is WastageEntryInput & { quantityKg: number } => typeof entry.quantityKg === 'number' && entry.quantityKg > 0,
    );
    if (withQuantity.length === 0) return [];

    const types = await Promise.all(withQuantity.map((entry) => findWastageType(undefined, companyId, stage, entry.code)));

    return withQuantity.map((entry, index) => {
        const type = types[index];
        if (!type || !type.isActive) {
            throw new NotFoundError(
                `Wastage type "${entry.code}" is not configured for stage ${stage}`,
                'WASTAGE_TYPE_NOT_FOUND',
                { stage, code: entry.code },
            );
        }
        return {
            wastageTypeId: type.id,
            colorId: entry.colorId,
            quantityKg: entry.quantityKg,
            actor,
        };
    });
}

/**
 * Applies wastage edits made while updating an existing production record.
 * Only include an entry for a (code) the caller actually wants to change —
 * omit anything not being touched. For each included entry: updates the
 * record's existing WastageRecord of that type if one exists, creates one if
 * a positive quantity is given and none exists yet, or deletes the existing
 * one if the new quantity is 0 (explicitly clearing that wastage).
 *
 * Runs inside the caller's transaction (`client`) so it stays atomic with the rest of the update.
 *
 * Time: O(k) — k = number of wastage entries being updated (at most 2 today).
 */
export async function applyWastageUpdates(
    client: pg.PoolClient,
    productionRecordId: string,
    stage: ProductionStage,
    companyId: string,
    actor: string,
    entries: WastageEntryInput[],
): Promise<void> {
    for (const entry of entries) {
        const type = await findWastageType(client, companyId, stage, entry.code);
        if (!type || !type.isActive) {
            throw new NotFoundError(
                `Wastage type "${entry.code}" is not configured for stage ${stage}`,
                'WASTAGE_TYPE_NOT_FOUND',
                { stage, code: entry.code },
            );
        }

        const existing = await findWastageRecordByTypeForProduction(client, productionRecordId, type.id);

        const quantityKg = entry.quantityKg ?? 0;
        if (quantityKg > 0) {
            if (existing) {
                await updateWastageRecord(client, existing.id, { quantityKg, colorId: entry.colorId, actor });
            } else {
                await insertWastageRecord(client, productionRecordId, {
                    companyId,
                    wastageTypeId: type.id,
                    colorId: entry.colorId,
                    quantityKg,
                    actor,
                });
            }
        } else if (existing) {
            await deleteWastageRecordById(client, existing.id);
        }
    }
}

export type WastageCategorySummary = { code: string; name: string; stage: ProductionStage; quantityKg: number };

/**
 * Wastage totals for a date range, one entry per configured WastageType
 * (the 5 client-terminology categories: YARN_WASTE, LUMPS, LOOMS_WASTE, FW,
 * BW) — backs the dashboard's monthly wastage panel. Names/stages are read
 * from WastageType rather than hard-coded, since operators may rename them
 * (see WASTAGE_CODES). A category with no activity this month still appears,
 * at 0, rather than being silently omitted.
 *
 * Time: O(n) — n = WastageRecord rows in the range (two queries, one pass).
 */
export async function getWastageSummaryByDateRange(
    companyId: string,
    dateFrom: Date,
    dateTo: Date,
): Promise<{ byType: WastageCategorySummary[]; totalKg: number }> {
    const codes: string[] = Object.values(WASTAGE_CODES);

    const [types, rows] = await Promise.all([
        findWastageTypesByCodes(companyId, codes),
        findWastageRecordsForDateRange(companyId, dateFrom, dateTo),
    ]);

    const quantityByCode = new Map<string, number>();
    for (const row of rows) {
        quantityByCode.set(row.code, (quantityByCode.get(row.code) ?? 0) + row.quantityKg);
    }

    const byType = types.map((type) => ({
        code: type.code,
        name: type.name,
        stage: type.stage,
        quantityKg: roundKg(quantityByCode.get(type.code) ?? 0),
    }));

    const totalKg = roundKg(byType.reduce((sum, type) => sum + type.quantityKg, 0));
    return { byType, totalKg };
}
