import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { assertColorExists, assertSizeExists } from './masterDataService.js';
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

export async function createOpeningBalanceFabricStock(input: CreateOpeningBalanceFabricStockInput, companyId: string, actor: string) {
    await assertVariantExists(input.colorId, input.sizeId, companyId);
    return createFabricStockRepo(toInsertInput(input, companyId, actor));
}

/** Creates every row from the "Add Row" modal in one call — each row may reference a different colour/size. */
export async function createOpeningBalanceFabricStockBatch(input: BatchCreateOpeningBalanceFabricStockInput, companyId: string, actor: string) {
    await Promise.all(input.items.map((item) => assertVariantExists(item.colorId, item.sizeId, companyId)));
    return createFabricStockBatchRepo(input.items.map((item) => toInsertInput(item, companyId, actor)));
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
    const existing = await existsFabricStock(id, companyId);
    if (!existing) throw new NotFoundError('Opening balance fabric stock record not found', 'OPENING_BALANCE_FABRIC_STOCK_NOT_FOUND', { id });

    await assertVariantExists(input.colorId ?? undefined, input.sizeId ?? undefined, companyId);

    return updateFabricStockRepo(id, companyId, input, actor);
}

export async function deleteOpeningBalanceFabricStock(id: string, companyId: string) {
    const existing = await existsFabricStock(id, companyId);
    if (!existing) throw new NotFoundError('Opening balance fabric stock record not found', 'OPENING_BALANCE_FABRIC_STOCK_NOT_FOUND', { id });

    await deleteFabricStockRepo(id, companyId);
}
