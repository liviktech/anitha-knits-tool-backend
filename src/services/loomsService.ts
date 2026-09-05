import { withTransaction } from '../db/transaction.js';
import { ProductionStage, ProductionType, UserRole } from '../types/enums.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { assertChemicalExists, assertColorExists, assertSizeExists } from './masterDataService.js';
import { buildWastageCreates } from './wastageService.js';
import { WASTAGE_CODES } from '../constants/wastageCodes.js';
import { roundKg } from '../utils/decimal.js';
import { assertCanCreateProductionRecord, assertCanDeleteProductionRecord, assertCanUpdateProductionRecord } from './productionCeilings.js';
import {
    approveProductionRecord,
    deleteProductionRecord,
    deleteWastagesForProduction,
    findLoomsExisting,
    findLoomsProductionByIdTx,
    findLoomsRowsForSummary,
    getAvailableYarnKgForVariant,
    getLoomsProductionById as getLoomsProductionByIdRepo,
    insertLoomsProduction,
    listLoomsProductions as listLoomsProductionsRepo,
    updateLoomsDetail,
    updateLoomsHeader,
    findLoomsWastagesForSummary,
    type LoomsRecordRow,
} from '../repositories/looms.repository.js';
import { insertWastageRecord } from '../repositories/wastage.repository.js';
import type { CreateLoomsInput, UpdateLoomsInput, ListLoomsQuery } from '../validations/loomsValidation.js';

/**
 * Looms is PRD §16.4: create/list/get, no approval workflow — records are
 * created directly and are immediately final.
 *
 * Yarn/Kora Balance consumption (PRD §8) beyond the Extruder-yarn-availability
 * check below is out of scope: Kora Balance isn't modeled in this schema.
 */

/**
 * Looms consumes yarn produced at the Extruder stage, so a colour+size variant can't
 * take in more yarn than Extruder has ever produced for it, net of what Looms has
 * already consumed. Cumulative across all history — unlike
 * fabricCheckingService.getAvailableFabricStockKg for the Looms→Fabric Checking stage,
 * which is scoped to a single production date instead.
 *
 * `excludeRecordId` omits a record's own existing yarnInputKg from the "already
 * consumed" side, so re-validating an update against its own prior value isn't a
 * false rejection.
 */
async function assertYarnInputWithinAvailable(
    companyId: string,
    colorId: string,
    sizeId: string,
    chemicalId: string,
    yarnInputKg: number,
    client?: import('pg').PoolClient,
    excludeRecordId?: string,
): Promise<void> {
    const availableKg = await getAvailableYarnKgForVariant(companyId, colorId, sizeId, chemicalId, client, excludeRecordId);
    if (yarnInputKg > availableKg) {
        throw new ConflictError(
            `Loom Production (${yarnInputKg} kg) exceeds the available Extruder yarn for this colour, size and chemical (${availableKg.toFixed(3)} kg available)`,
            'YARN_INPUT_EXCEEDS_AVAILABLE',
            { colorId, sizeId, chemicalId, availableKg, requestedKg: yarnInputKg },
        );
    }
}

/** Backs GET /production/looms/available — lets the entry form show/validate against the same cumulative figure the create/update guard enforces. */
export async function getAvailableYarnStockKg(companyId: string, colorId: string, sizeId: string, chemicalId: string): Promise<number> {
    return getAvailableYarnKgForVariant(companyId, colorId, sizeId, chemicalId);
}

function mapLoomsRecord(record: LoomsRecordRow) {
    return record;
}

export async function createLoomsProduction(input: CreateLoomsInput, companyId: string, actor: string, role: UserRole, callerId: string) {
    await assertCanCreateProductionRecord(role, callerId, companyId);

    await Promise.all([
        assertColorExists(input.colorId, companyId),
        assertSizeExists(input.sizeId, companyId),
        assertChemicalExists(input.chemicalId, companyId),
    ]);

    // BW ("Bit Wastage") is colour-tracked (PRD "B White"/"B Blue"), so it's
    // stored against this record's own colour; FW ("Fabric Wastage") is not.
    const wastagePlans = await buildWastageCreates(ProductionStage.LOOMS, companyId, actor, [
        { code: WASTAGE_CODES.LOOMS_WASTE, quantityKg: input.loomsWasteKg },
    ]);

    const record = await withTransaction(async (client) => {
        await assertYarnInputWithinAvailable(companyId, input.colorId, input.sizeId, input.chemicalId, input.yarnInputKg, client);

        const productionRecordId = await insertLoomsProduction(client, {
            companyId,
            productionDate: input.productionDate,
            colorId: input.colorId,
            sizeId: input.sizeId,
            chemicalId: input.chemicalId,
            type: input.type,
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
        input.chemicalId ? assertChemicalExists(input.chemicalId, companyId) : undefined,
    ]);

    const updated = await withTransaction(async (client) => {
        if (input.yarnInputKg !== undefined || input.colorId !== undefined || input.sizeId !== undefined || input.chemicalId !== undefined) {
            await assertYarnInputWithinAvailable(
                companyId,
                input.colorId ?? existing.colorId,
                input.sizeId ?? existing.sizeId,
                input.chemicalId ?? existing.chemicalId,
                input.yarnInputKg ?? existing.yarnInputKg,
                client,
                id,
            );
        }

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
            chemicalId: input.chemicalId,
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

export type LoomsProductionVariantSummary = {
    color: { id: string; name: string };
    size: { id: string; name: string };
    production: number;
    waste: number;
    total: number;
};

export type LoomsProductionColorSummary = {
    color: { id: string; name: string };
    production: number;
    waste: number;
    total: number;
};

export type LoomsProductionSummary = {
    byVariant: LoomsProductionVariantSummary[];
    byColor: LoomsProductionColorSummary[];
    overall: { production: number };
};

export async function getLoomsProductionSummaryByDateRange(
    companyId: string,
    dateFrom: Date,
    dateTo: Date,
    type: ProductionType = ProductionType.PRODUCTION,
): Promise<LoomsProductionSummary> {
    const [rows, wastageRows] = await Promise.all([
        findLoomsRowsForSummary(companyId, dateFrom, dateTo, type),
        findLoomsWastagesForSummary(companyId, dateFrom, dateTo, type),
    ]);

    const wastagesByProductionRecordId = new Map<string, number>();
    for (const w of wastageRows) {
        if (w.wastageTypeCode === WASTAGE_CODES.LOOMS_WASTE) {
            const current = wastagesByProductionRecordId.get(w.productionRecordId) ?? 0;
            wastagesByProductionRecordId.set(w.productionRecordId, current + w.quantityKg);
        }
    }

    const byVariantMap = new Map<string, LoomsProductionVariantSummary>();
    const byColorMap = new Map<string, LoomsProductionColorSummary>();
    const overall = { production: 0 };

    for (const row of rows) {
        const production = row.fabricOutputKg ?? 0;
        overall.production += production;

        const color = row.colorId ? { id: row.colorId, name: row.colorName! } : { id: 'UNSPECIFIED', name: 'Unspecified' };
        const size = row.sizeId ? { id: row.sizeId, name: row.sizeName! } : { id: 'UNSPECIFIED', name: 'Unspecified' };

        const waste = wastagesByProductionRecordId.get(row.id) ?? 0;

        const variantKey = `${color.id}_${size.id}`;
        let variantEntry = byVariantMap.get(variantKey);
        if (!variantEntry) {
            variantEntry = { color, size, production: 0, waste: 0, total: 0 };
            byVariantMap.set(variantKey, variantEntry);
        }
        variantEntry.production += production;
        variantEntry.waste += waste;

        let colorEntry = byColorMap.get(color.id);
        if (!colorEntry) {
            colorEntry = { color, production: 0, waste: 0, total: 0 };
            byColorMap.set(color.id, colorEntry);
        }
        colorEntry.production += production;
        colorEntry.waste += waste;
    }

    return {
        byVariant: Array.from(byVariantMap.values()).map((entry) => ({
            ...entry,
            production: roundKg(entry.production),
            waste: roundKg(entry.waste),
            total: roundKg(entry.production + entry.waste),
        })),
        byColor: Array.from(byColorMap.values()).map((entry) => ({
            ...entry,
            production: roundKg(entry.production),
            waste: roundKg(entry.waste),
            total: roundKg(entry.production + entry.waste),
        })),
        overall: { production: roundKg(overall.production) },
    };
}
