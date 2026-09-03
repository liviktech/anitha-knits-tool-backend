import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { assertColorExists, assertSizeExists } from './masterDataService.js';
import {
    createWastage as createWastageRepo,
    createWastageBatch as createWastageBatchRepo,
    deleteWastage as deleteWastageRepo,
    existsWastage,
    findWastageById,
    listWastage as listWastageRepo,
    updateWastage as updateWastageRepo,
    type InsertWastageInput,
} from '../repositories/openingBalanceWastage.repository.js';
import type {
    BatchCreateOpeningBalanceWastageInput,
    CreateOpeningBalanceWastageInput,
    ListOpeningBalanceWastageQuery,
    UpdateOpeningBalanceWastageInput,
} from '../validations/openingBalanceWastageValidation.js';

async function assertVariantExists(colorId: string | undefined, sizeId: string | undefined, companyId: string) {
    await Promise.all([colorId ? assertColorExists(colorId, companyId) : undefined, sizeId ? assertSizeExists(sizeId, companyId) : undefined]);
}

function toInsertInput(input: CreateOpeningBalanceWastageInput, companyId: string, actor: string): InsertWastageInput {
    return {
        companyId,
        date: input.date,
        colorId: input.colorId,
        sizeId: input.sizeId,
        extruderLumpsKg: input.extruderLumpsKg,
        extruderLoomsWasteKg: input.extruderLoomsWasteKg,
        loomsYarnWasteKg: input.loomsYarnWasteKg,
        fabricWasteKg: input.fabricWasteKg,
        fabricBitwasteKg: input.fabricBitwasteKg,
        actor,
    };
}

export async function createOpeningBalanceWastage(input: CreateOpeningBalanceWastageInput, companyId: string, actor: string) {
    await assertVariantExists(input.colorId, input.sizeId, companyId);
    return createWastageRepo(toInsertInput(input, companyId, actor));
}

/** Creates every row from the "Add Row" modal in one call — each row may reference a different colour/size. */
export async function createOpeningBalanceWastageBatch(input: BatchCreateOpeningBalanceWastageInput, companyId: string, actor: string) {
    await Promise.all(input.items.map((item) => assertVariantExists(item.colorId, item.sizeId, companyId)));
    return createWastageBatchRepo(input.items.map((item) => toInsertInput(item, companyId, actor)));
}

export async function listOpeningBalanceWastage(query: ListOpeningBalanceWastageQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await listWastageRepo(
        companyId,
        { dateFrom: query.date_from, dateTo: query.date_to, colorId: query.color_id, sizeId: query.size_id },
        skip,
        take,
    );
    return { items: rows, meta: toPageMeta(query, total) };
}

export async function getOpeningBalanceWastageById(id: string, companyId: string) {
    const record = await findWastageById(id, companyId);
    if (!record) throw new NotFoundError('Opening balance wastage record not found', 'OPENING_BALANCE_WASTAGE_NOT_FOUND', { id });
    return record;
}

export async function updateOpeningBalanceWastage(id: string, input: UpdateOpeningBalanceWastageInput, companyId: string, actor: string) {
    const existing = await existsWastage(id, companyId);
    if (!existing) throw new NotFoundError('Opening balance wastage record not found', 'OPENING_BALANCE_WASTAGE_NOT_FOUND', { id });

    await assertVariantExists(input.colorId ?? undefined, input.sizeId ?? undefined, companyId);

    return updateWastageRepo(id, companyId, input, actor);
}

export async function deleteOpeningBalanceWastage(id: string, companyId: string) {
    const existing = await existsWastage(id, companyId);
    if (!existing) throw new NotFoundError('Opening balance wastage record not found', 'OPENING_BALANCE_WASTAGE_NOT_FOUND', { id });

    await deleteWastageRepo(id, companyId);
}
