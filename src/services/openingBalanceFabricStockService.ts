import { withTransaction } from '../db/transaction.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { assertColorExists, assertSizeExists } from './masterDataService.js';
import { applyOpeningBalanceKoraEffect, reverseOpeningBalanceKoraEffect } from './koraBalanceService.js';
import {
    createFabricStock as createFabricStockRepo,
    createFabricStockBatch as createFabricStockBatchRepo,
    deleteFabricStock as deleteFabricStockRepo,
    existsFabricStock,
    findFabricStockById,
    listFabricStock as listFabricStockRepo,
    updateFabricStock as updateFabricStockRepo,
    type InsertFabricStockInput,
} from '../repositories/openingBalanceFabricStock.repository.js';
import type {
    BatchCreateOpeningBalanceFabricStockInput,
    CreateOpeningBalanceFabricStockInput,
    ListOpeningBalanceFabricStockQuery,
    UpdateOpeningBalanceFabricStockInput,
} from '../validations/openingBalanceFabricStockValidation.js';

async function assertVariantExists(colorId: string | undefined, sizeId: string | undefined, companyId: string) {
    await Promise.all([colorId ? assertColorExists(colorId, companyId) : undefined, sizeId ? assertSizeExists(sizeId, companyId) : undefined]);
}

function toInsertInput(input: CreateOpeningBalanceFabricStockInput, companyId: string, actor: string): InsertFabricStockInput {
    return {
        companyId,
        date: input.date,
        colorId: input.colorId,
        sizeId: input.sizeId,
        koraBalanceKg: input.koraBalanceKg,
        fabricStockKg: input.fabricStockKg,
        actor,
    };
}

/**
 * Records a starting Kora balance (per PATCH request from `handleSave` above) don't just sit
 * on their own opening_balance_fabric_stock row — this also credits the live kora_balances
 * ledger, in the same transaction as the row write, so GET /kora-balance and Fabric Checking's
 * available-stock check reflect it immediately. Only possible when both colour and size are
 * set — kora_balances has no concept of a variant-less balance.
 */
export async function createOpeningBalanceFabricStock(input: CreateOpeningBalanceFabricStockInput, companyId: string, actor: string) {
    await assertVariantExists(input.colorId, input.sizeId, companyId);

    return withTransaction(async (client) => {
        const record = await createFabricStockRepo(toInsertInput(input, companyId, actor), client);

        if (input.colorId && input.sizeId) {
            await applyOpeningBalanceKoraEffect(companyId, input.colorId, input.sizeId, input.koraBalanceKg, input.date, record.id, actor, client);
        }

        return record;
    });
}

/** Creates every row from the "Add Row" modal in one call — each row may reference a different colour/size, all atomic with their kora_balances effects (see createOpeningBalanceFabricStock). */
export async function createOpeningBalanceFabricStockBatch(input: BatchCreateOpeningBalanceFabricStockInput, companyId: string, actor: string) {
    await Promise.all(input.items.map((item) => assertVariantExists(item.colorId, item.sizeId, companyId)));

    return withTransaction(async (client) => {
        const records = await createFabricStockBatchRepo(
            input.items.map((item) => toInsertInput(item, companyId, actor)),
            client,
        );

        for (const [i, record] of records.entries()) {
            const item = input.items[i]!;
            if (item.colorId && item.sizeId) {
                await applyOpeningBalanceKoraEffect(companyId, item.colorId, item.sizeId, item.koraBalanceKg, item.date, record.id, actor, client);
            }
        }

        return records;
    });
}

export async function listOpeningBalanceFabricStock(query: ListOpeningBalanceFabricStockQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await listFabricStockRepo(
        companyId,
        { dateFrom: query.date_from, dateTo: query.date_to, colorId: query.color_id, sizeId: query.size_id },
        skip,
        take,
    );
    return { items: rows, meta: toPageMeta(query, total) };
}

export async function getOpeningBalanceFabricStockById(id: string, companyId: string) {
    const record = await findFabricStockById(id, companyId);
    if (!record) throw new NotFoundError('Opening balance fabric stock record not found', 'OPENING_BALANCE_FABRIC_STOCK_NOT_FOUND', { id });
    return record;
}

export async function updateOpeningBalanceFabricStock(id: string, input: UpdateOpeningBalanceFabricStockInput, companyId: string, actor: string) {
    const existing = await findFabricStockById(id, companyId);
    if (!existing) throw new NotFoundError('Opening balance fabric stock record not found', 'OPENING_BALANCE_FABRIC_STOCK_NOT_FOUND', { id });

    await assertVariantExists(input.colorId ?? undefined, input.sizeId ?? undefined, companyId);

    // `in` (not `??`) so an explicit `null` — clearing the colour/size — is distinguished from
    // the key being absent (leave as-is), matching updateFabricStockRepo's own patch semantics.
    const koraAffectingFieldsChanged = 'colorId' in input || 'sizeId' in input || input.koraBalanceKg !== undefined;

    return withTransaction(async (client) => {
        const updated = await updateFabricStockRepo(id, companyId, input, actor, client);

        if (koraAffectingFieldsChanged) {
            // Reverse this record's prior effect using its own ledger entry (exact even if the
            // variant is changing), then recredit against the now-current merged values —
            // mirroring fabricCheckingService.updateFabricCheckingRecord's own logic.
            await reverseOpeningBalanceKoraEffect(id, client);

            const finalColorId = 'colorId' in input ? input.colorId : existing.color?.id;
            const finalSizeId = 'sizeId' in input ? input.sizeId : existing.size?.id;
            const finalKoraBalanceKg = input.koraBalanceKg ?? existing.koraBalanceKg;
            const finalDate = input.date ?? existing.date;

            if (finalColorId && finalSizeId) {
                await applyOpeningBalanceKoraEffect(companyId, finalColorId, finalSizeId, finalKoraBalanceKg, finalDate, id, actor, client);
            }
        }

        return updated;
    });
}

export async function deleteOpeningBalanceFabricStock(id: string, companyId: string) {
    const existing = await existsFabricStock(id, companyId);
    if (!existing) throw new NotFoundError('Opening balance fabric stock record not found', 'OPENING_BALANCE_FABRIC_STOCK_NOT_FOUND', { id });

    await withTransaction(async (client) => {
        await reverseOpeningBalanceKoraEffect(id, client);
        await deleteFabricStockRepo(id, companyId, client);
    });
}
