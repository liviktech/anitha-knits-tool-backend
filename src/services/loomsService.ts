import { withTransaction } from '../db/transaction.js';
import { ProductionStage, UserRole } from '../types/enums.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { assertColorExists, assertSizeExists } from './masterDataService.js';
import { buildWastageCreates } from './wastageService.js';
import { WASTAGE_CODES } from '../constants/wastageCodes.js';
import { assertCanCreateProductionRecord, assertCanDeleteProductionRecord, assertCanUpdateProductionRecord } from './productionCeilings.js';
import {
    approveProductionRecord,
    deleteProductionRecord,
    deleteWastagesForProduction,
    findLoomsExisting,
    findLoomsProductionByIdTx,
    findLoomsRowsForSummary,
    getLoomsProductionById as getLoomsProductionByIdRepo,
    insertLoomsProduction,
    listLoomsProductions as listLoomsProductionsRepo,
    updateLoomsDetail,
    updateLoomsHeader,
    type LoomsRecordRow,
} from '../repositories/looms.repository.js';
import { insertWastageRecord } from '../repositories/wastage.repository.js';
import type { CreateLoomsInput, UpdateLoomsInput, ListLoomsQuery } from '../validations/loomsValidation.js';

/**
 * Looms is PRD §16.4: create/list/get, no approval workflow — records are
 * created directly and are immediately final.
 *
 * Yarn/Kora Balance consumption (PRD §8) is out of scope: Kora Balance isn't
 * modeled in this schema.
 */

function mapLoomsRecord(record: LoomsRecordRow) {
    return record;
}

export async function createLoomsProduction(input: CreateLoomsInput, companyId: string, actor: string, role: UserRole, callerId: string) {
    await assertCanCreateProductionRecord(role, callerId, companyId);

    await Promise.all([assertColorExists(input.colorId, companyId), assertSizeExists(input.sizeId, companyId)]);

    // BW ("Bit Wastage") is colour-tracked (PRD "B White"/"B Blue"), so it's
    // stored against this record's own colour; FW ("Fabric Wastage") is not.
    const wastagePlans = await buildWastageCreates(ProductionStage.LOOMS, companyId, actor, [
        { code: WASTAGE_CODES.LOOMS_WASTE, quantityKg: input.loomsWasteKg },
    ]);

    const record = await withTransaction(async (client) => {
        const productionRecordId = await insertLoomsProduction(client, {
            companyId,
            productionDate: input.productionDate,
            colorId: input.colorId,
            sizeId: input.sizeId,
            remarks: input.remarks,
            actor,
            yarnInputKg: input.yarnInputKg,
            fabricOutputKg: input.fabricOutputKg,
        });

        for (const plan of wastagePlans) {
            await insertWastageRecord(client, productionRecordId, { companyId, ...plan });
        }

        // Kora balance is no longer credited here — it's credited lazily from the
        // matching Loom record's fabricOutputKg when Fabric Checking is created
        // against this color+size (see fabricCheckingService.createFabricCheckingRecord).
        return findLoomsProductionByIdTx(client, productionRecordId);
    });

    return mapLoomsRecord(record);
}

export async function listLoomsProductions(query: ListLoomsQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await listLoomsProductionsRepo(query, companyId, skip, take);

    return { items: rows.map(mapLoomsRecord), meta: toPageMeta(query, total) };
}

export async function getLoomsProductionById(id: string, companyId: string) {
    const record = await getLoomsProductionByIdRepo(id, companyId);
    if (!record) throw new NotFoundError('Looms production not found', 'LOOMS_NOT_FOUND', { id });
    return mapLoomsRecord(record);
}

export async function updateLoomsProduction(id: string, input: UpdateLoomsInput, companyId: string, actor: string, role: UserRole, callerId: string) {
    const existing = await findLoomsExisting(id, companyId);
    if (!existing) throw new NotFoundError('Looms production not found', 'LOOMS_NOT_FOUND', { id });

    await assertCanUpdateProductionRecord(role, callerId, companyId, existing.isApproved);

    await Promise.all([
        input.colorId ? assertColorExists(input.colorId, companyId) : undefined,
        input.sizeId ? assertSizeExists(input.sizeId, companyId) : undefined,
    ]);

    const updated = await withTransaction(async (client) => {
        await updateLoomsHeader(client, id, {
            productionDate: input.productionDate,
            colorId: input.colorId,
            sizeId: input.sizeId,
            remarks: input.remarks,
            actor,
        });

        await updateLoomsDetail(client, id, {
            yarnInputKg: input.yarnInputKg,
            fabricOutputKg: input.fabricOutputKg,
        });

        return findLoomsProductionByIdTx(client, id);
    });

    return mapLoomsRecord(updated);
}

export async function deleteLoomsProduction(id: string, companyId: string, role: UserRole): Promise<void> {
    assertCanDeleteProductionRecord(role);

    const existing = await findLoomsExisting(id, companyId);
    if (!existing) throw new NotFoundError('Looms production not found', 'LOOMS_NOT_FOUND', { id });

    await withTransaction(async (client) => {
        // WastageRecord has no onDelete: Cascade to ProductionRecord, so it
        // must be cleared explicitly before the record itself can be deleted.
        await deleteWastagesForProduction(client, id);
        await deleteProductionRecord(client, id);
    });
}

/** ADMIN-only (enforced at the route level) — sets isApproved, never exposed via Right/RoleAccess. */
export async function approveLoomsProduction(id: string, companyId: string, actor: string) {
    const existing = await findLoomsExisting(id, companyId);
    if (!existing) throw new NotFoundError('Looms production not found', 'LOOMS_NOT_FOUND', { id });

    await approveProductionRecord(id, actor);
    const record = await getLoomsProductionByIdRepo(id, companyId);
    return mapLoomsRecord(record!);
}

export async function getLoomsProductionSummaryByDateRange(companyId: string, dateFrom: Date, dateTo: Date) {
    const rows = await findLoomsRowsForSummary(companyId, dateFrom, dateTo);

    const byColorMap = new Map<string, { color: { id: string; name: string }; production: number; waste: number }>();

    for (const row of rows) {
        const colorKey = row.colorId ?? 'UNSPECIFIED';
        let entry = byColorMap.get(colorKey);
        if (!entry) {
            entry = { color: row.colorId ? { id: row.colorId, name: row.colorName! } : { id: 'UNSPECIFIED', name: 'Unspecified' }, production: 0, waste: 0 };
            byColorMap.set(colorKey, entry);
        }
        entry.production += row.fabricOutputKg ?? 0;
    }

    const roundKg = (val: number) => Math.round(val * 1000) / 1000;

    return Array.from(byColorMap.values()).map((e) => ({
        ...e,
        production: roundKg(e.production),
        waste: roundKg(e.waste),
        total: roundKg(e.production + e.waste),
    }));
}
