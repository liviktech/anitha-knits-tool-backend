import { withTransaction } from '../db/transaction.js';
import { ProductionStage, UserRole } from '../types/enums.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { roundKg } from '../utils/decimal.js';
import { assertChemicalExists, assertColorExists, assertSizeExists } from './masterDataService.js';
import { applyWastageUpdates, buildWastageCreates } from './wastageService.js';
import { WASTAGE_CODES } from '../constants/wastageCodes.js';
import { updateKoraBalance, reverseKoraBalance, getCurrentKoraBalanceKg, getKoraBalanceExcludingRecord } from './koraBalanceService.js';
import { assertCanCreateProductionRecord, assertCanDeleteProductionRecord, assertCanUpdateProductionRecord } from './productionCeilings.js';
import {
    approveProductionRecord,
    deleteProductionRecord,
    deleteWastagesForProduction,
    findFabricCheckingExisting,
    findFabricCheckingProductionByIdTx,
    findFabricCheckingRowsForSummary,
    findFabricCheckingWastagesForSummary,
    findLatestLoomFabricOutput,
    getAvailableFabricKgForVariant,
    getFabricCheckingProductionById as getFabricCheckingProductionByIdRepo,
    insertFabricCheckingProduction,
    listFabricCheckingProductions as listFabricCheckingProductionsRepo,
    updateFabricCheckingDetail,
    updateFabricCheckingHeader,
    type FabricCheckingRecordRow,
} from '../repositories/fabricChecking.repository.js';
import { insertWastageRecord } from '../repositories/wastage.repository.js';
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

function mapFabricCheckingRecord(record: FabricCheckingRecordRow) {
    return record;
}

/**
 * Fabric Checking can draw on two pools: that same day's Looms production for this colour+size
 * (net of what's already been checked against that same day, not cumulative across history —
 * see getAvailableFabricKgForVariant), plus whatever Kora Stock is sitting in the ledger for
 * it. This mirrors the Fabric Checking form's own "Total Available" figure (Production
 * Available + Kora Stock) exactly, so a save the form allowed never gets rejected here.
 *
 * `excludeRecordId` (an update) omits the record's own existing fabricInputKg from the Looms
 * side's "already consumed" figure, and on the Kora side subtracts this same record's own
 * ledger effect back out of the current balance (see getKoraBalanceExcludingRecord) instead
 * of using it as-is — same reasoning as the form's own useKoraBalanceExcludingRecord for
 * editing. A create (no excludeRecordId) instead uses the current balance directly, matching
 * what the form showed when adding this record.
 */
async function assertFabricInputWithinAvailable(
    companyId: string,
    colorId: string,
    sizeId: string,
    chemicalId: string,
    fabricInputKg: number,
    productionDate: Date,
    client?: import('pg').PoolClient,
    excludeRecordId?: string,
): Promise<void> {
    const productionAvailableKg = await getAvailableFabricKgForVariant(companyId, colorId, sizeId, chemicalId, productionDate, client, excludeRecordId);
    const koraStockKg = excludeRecordId
        ? await getKoraBalanceExcludingRecord(companyId, colorId, sizeId, excludeRecordId, client)
        : await getCurrentKoraBalanceKg(companyId, colorId, sizeId, client);
    const availableKg = productionAvailableKg + koraStockKg;

    if (fabricInputKg > availableKg) {
        throw new ConflictError(
            `Fabric input (${fabricInputKg} kg) exceeds the total available stock for this colour, size and chemical ` +
                `(${availableKg.toFixed(3)} kg available: ${productionAvailableKg.toFixed(3)} kg Looms production + ${koraStockKg.toFixed(3)} kg Kora stock)`,
            'FABRIC_INPUT_EXCEEDS_AVAILABLE',
            { colorId, sizeId, chemicalId, availableKg, productionAvailableKg, koraStockKg, requestedKg: fabricInputKg },
        );
    }
}

/** Backs GET /fabric-checking/available — lets the entry form show/validate against the same single-day figure the create/update guard enforces. */
export async function getAvailableFabricStockKg(companyId: string, colorId: string, sizeId: string, chemicalId: string, productionDate: Date): Promise<number> {
    return getAvailableFabricKgForVariant(companyId, colorId, sizeId, chemicalId, productionDate);
}

export async function createFabricCheckingRecord(
    input: CreateFabricCheckingInput,
    companyId: string,
    actor: string,
    role: UserRole,
    callerId: string,
) {
    await assertCanCreateProductionRecord(role, callerId, companyId);

    await Promise.all([
        assertColorExists(input.colorId, companyId),
        assertSizeExists(input.sizeId, companyId),
        assertChemicalExists(input.chemicalId, companyId),
    ]);

    // BW ("Bit Wastage") is colour-tracked (PRD "B White"/"B Blue"), so it's
    // stored against this record's own colour; FW ("Fabric Wastage") is not.
    const wastagePlans = await buildWastageCreates(ProductionStage.FABRIC_CHECKING, companyId, actor, [
        { code: WASTAGE_CODES.FW, quantityKg: input.fwKg },
        { code: WASTAGE_CODES.BW, quantityKg: input.bwKg, colorId: input.colorId },
    ]);

    const record = await withTransaction(async (client) => {
        await assertFabricInputWithinAvailable(companyId, input.colorId, input.sizeId, input.chemicalId, input.fabricInputKg, input.productionDate, client);

        const productionRecordId = await insertFabricCheckingProduction(client, {
            companyId,
            productionDate: input.productionDate,
            colorId: input.colorId,
            sizeId: input.sizeId,
            chemicalId: input.chemicalId,
            type: input.type,
            remarks: input.remarks,
            actor,
            fabricInputKg: input.fabricInputKg,
            outputKg: input.outputKg,
        });

        for (const plan of wastagePlans) {
            await insertWastageRecord(client, productionRecordId, { companyId, ...plan });
        }

        // Kora balance is no longer credited at Loom creation time (see
        // loomsService.createLoomsProduction) — it's updated here instead, net of the
        // latest Loom batch's fabric output against this check's fabric input.
        const latestLoomFabricOutputKg = await findLatestLoomFabricOutput(client, companyId, input.colorId, input.sizeId);

        await updateKoraBalance(
            companyId,
            input.colorId,
            input.sizeId,
            latestLoomFabricOutputKg ?? 0,
            input.fabricInputKg,
            input.productionDate,
            productionRecordId,
            actor,
            client,
        );

        return findFabricCheckingProductionByIdTx(client, productionRecordId);
    });

    return mapFabricCheckingRecord(record);
}

export async function listFabricCheckingRecords(query: ListFabricCheckingQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await listFabricCheckingProductionsRepo(query, companyId, skip, take);

    return { items: rows.map(mapFabricCheckingRecord), meta: toPageMeta(query, total) };
}

export async function getFabricCheckingRecordById(id: string, companyId: string) {
    const record = await getFabricCheckingProductionByIdRepo(id, companyId);
    if (!record) throw new NotFoundError('Fabric checking record not found', 'FABRIC_CHECKING_NOT_FOUND', { id });
    return mapFabricCheckingRecord(record);
}

export async function updateFabricCheckingRecord(
    id: string,
    input: UpdateFabricCheckingInput,
    companyId: string,
    actor: string,
    role: UserRole,
    callerId: string,
) {
    const existing = await findFabricCheckingExisting(id, companyId);
    if (!existing) throw new NotFoundError('Fabric checking record not found', 'FABRIC_CHECKING_NOT_FOUND', { id });

    await assertCanUpdateProductionRecord(role, callerId, companyId, existing.isApproved);

    await Promise.all([
        input.colorId ? assertColorExists(input.colorId, companyId) : undefined,
        input.sizeId ? assertSizeExists(input.sizeId, companyId) : undefined,
        input.chemicalId ? assertChemicalExists(input.chemicalId, companyId) : undefined,
    ]);

    // Any of these four changing invalidates the kora ledger entry this record created
    // back in createFabricCheckingRecord — net = latest Loom batch's fabric output minus
    // this record's fabricInputKg, keyed by colour+size. productionDate/chemicalId also
    // affect the Looms-availability guard now that it's scoped to a single day and chemical
    // (see getAvailableFabricKgForVariant) rather than cumulative across all history.
    const koraAffectingFieldsChanged =
        input.fabricInputKg !== undefined ||
        input.colorId !== undefined ||
        input.sizeId !== undefined ||
        input.chemicalId !== undefined ||
        input.productionDate !== undefined;

    const updated = await withTransaction(async (client) => {
        const finalFabricInputKg = koraAffectingFieldsChanged ? input.fabricInputKg ?? existing.fabricInputKg : undefined;
        const finalColorId = input.colorId ?? existing.colorId;
        const finalSizeId = input.sizeId ?? existing.sizeId;
        const finalChemicalId = input.chemicalId ?? existing.chemicalId;
        const finalProductionDate = input.productionDate ?? existing.productionDate;

        if (koraAffectingFieldsChanged) {
            await assertFabricInputWithinAvailable(companyId, finalColorId, finalSizeId, finalChemicalId, finalFabricInputKg!, finalProductionDate, client, id);
        }

        await updateFabricCheckingHeader(client, id, {
            productionDate: input.productionDate,
            colorId: input.colorId,
            sizeId: input.sizeId,
            remarks: input.remarks,
            actor,
        });

        await updateFabricCheckingDetail(client, id, {
            fabricInputKg: input.fabricInputKg,
            outputKg: input.outputKg,
            chemicalId: input.chemicalId,
        });

        // Reverse this record's prior effect on the kora ledger (using its own ledger entry,
        // so the reversal is exact even if the variant is changing) and recompute against the
        // now-current values and variant — mirroring create's own logic exactly.
        if (koraAffectingFieldsChanged) {
            await reverseKoraBalance(id, client);

            const latestLoomFabricOutputKg = await findLatestLoomFabricOutput(client, companyId, finalColorId, finalSizeId);

            await updateKoraBalance(
                companyId,
                finalColorId,
                finalSizeId,
                latestLoomFabricOutputKg ?? 0,
                finalFabricInputKg!,
                finalProductionDate,
                id,
                actor,
                client,
            );
        }

        const wastageUpdates = [
            ...(input.fwKg !== undefined ? [{ code: WASTAGE_CODES.FW, quantityKg: input.fwKg }] : []),
            ...(input.bwKg !== undefined ? [{ code: WASTAGE_CODES.BW, quantityKg: input.bwKg, colorId: input.colorId ?? existing.colorId }] : []),
        ];
        if (wastageUpdates.length > 0) {
            await applyWastageUpdates(client, id, ProductionStage.FABRIC_CHECKING, companyId, actor, wastageUpdates);
        }

        return findFabricCheckingProductionByIdTx(client, id);
    });

    return mapFabricCheckingRecord(updated);
}

export type FabricProductionVariantSummary = {
    color: { id: string; name: string };
    size: { id: string; name: string };
    fabricInputKg: number;
    outputKg: number;
    fwWasteKg: number;
    bwWasteKg: number;
    total: number;
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
 * Time: O(n) — n = Fabric Checking records in the range (two queries, one pass).
 */
export async function getFabricProductionSummaryByDateRange(companyId: string, dateFrom: Date, dateTo: Date): Promise<FabricProductionSummary> {
    const [rows, wastageRows] = await Promise.all([
        findFabricCheckingRowsForSummary(companyId, dateFrom, dateTo),
        findFabricCheckingWastagesForSummary(companyId, dateFrom, dateTo),
    ]);

    const wastagesByProductionRecordId = new Map<string, { fw: number; bw: number }>();
    for (const w of wastageRows) {
        let entry = wastagesByProductionRecordId.get(w.productionRecordId);
        if (!entry) {
            entry = { fw: 0, bw: 0 };
            wastagesByProductionRecordId.set(w.productionRecordId, entry);
        }
        if (w.wastageTypeCode === WASTAGE_CODES.FW) entry.fw += w.quantityKg;
        else if (w.wastageTypeCode === WASTAGE_CODES.BW) entry.bw += w.quantityKg;
    }

    const byVariantMap = new Map<string, FabricProductionVariantSummary>();
    const byColorMap = new Map<string, FabricProductionColorSummary>();
    const overall = { fabricInputKg: 0, outputKg: 0 };

    for (const row of rows) {
        if (row.fabricInputKg === null) continue;
        const inputKg = row.fabricInputKg;
        const outputKg = row.outputKg ?? 0;

        overall.fabricInputKg += inputKg;
        overall.outputKg += outputKg;

        const color = row.colorId ? { id: row.colorId, name: row.colorName! } : { id: 'UNSPECIFIED', name: 'Unspecified' };
        const size = row.sizeId ? { id: row.sizeId, name: row.sizeName! } : { id: 'UNSPECIFIED', name: 'Unspecified' };

        const wastageForRow = wastagesByProductionRecordId.get(row.id);
        const fw = wastageForRow?.fw ?? 0;
        const bw = wastageForRow?.bw ?? 0;

        const variantKey = `${color.id}_${size.id}`;
        let variantEntry = byVariantMap.get(variantKey);
        if (!variantEntry) {
            variantEntry = { color, size, fabricInputKg: 0, outputKg: 0, fwWasteKg: 0, bwWasteKg: 0, total: 0 };
            byVariantMap.set(variantKey, variantEntry);
        }
        variantEntry.fabricInputKg += inputKg;
        variantEntry.outputKg += outputKg;
        variantEntry.fwWasteKg += fw;
        variantEntry.bwWasteKg += bw;

        let colorEntry = byColorMap.get(color.id);
        if (!colorEntry) {
            colorEntry = { color, production: 0, fwWasteKg: 0, bwWasteKg: 0, total: 0 };
            byColorMap.set(color.id, colorEntry);
        }
        colorEntry.production += outputKg;
        colorEntry.fwWasteKg += fw;
        colorEntry.bwWasteKg += bw;
    }

    return {
        byVariant: Array.from(byVariantMap.values()).map((entry) => ({
            ...entry,
            fabricInputKg: roundKg(entry.fabricInputKg),
            outputKg: roundKg(entry.outputKg),
            fwWasteKg: roundKg(entry.fwWasteKg),
            bwWasteKg: roundKg(entry.bwWasteKg),
            total: roundKg(entry.outputKg + entry.fwWasteKg + entry.bwWasteKg),
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

export async function deleteFabricCheckingRecord(id: string, companyId: string, role: UserRole): Promise<void> {
    assertCanDeleteProductionRecord(role);

    const existing = await findFabricCheckingExisting(id, companyId);
    if (!existing) throw new NotFoundError('Fabric checking record not found', 'FABRIC_CHECKING_NOT_FOUND', { id });

    await withTransaction(async (client) => {
        // WastageRecord and the kora ledger entry both have no onDelete: Cascade to
        // ProductionRecord, so both must be cleared explicitly before the record itself
        // can be deleted. reverseKoraBalance also undoes this record's effect on the
        // running kora balance.
        await deleteWastagesForProduction(client, id);
        await reverseKoraBalance(id, client);
        await deleteProductionRecord(client, id);
    });
}

/** ADMIN-only (enforced at the route level) — sets isApproved, never exposed via Right/RoleAccess. */
export async function approveFabricCheckingRecord(id: string, companyId: string, actor: string) {
    const existing = await findFabricCheckingExisting(id, companyId);
    if (!existing) throw new NotFoundError('Fabric checking record not found', 'FABRIC_CHECKING_NOT_FOUND', { id });

    await approveProductionRecord(id, actor);
    const record = await getFabricCheckingProductionByIdRepo(id, companyId);
    return mapFabricCheckingRecord(record!);
}
