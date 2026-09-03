import crypto from 'crypto';
import { InventoryType } from '../types/enums.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { findLookupItemName } from '../repositories/lookupItem.repository.js';
import {
    createRawMaterialBatch,
    deleteRawMaterialGroup,
    findRawMaterialGroupExisting,
    findRawMaterialGroupIds,
    listRawMaterials as listRawMaterialsRepo,
    replaceRawMaterialGroup,
    type InsertRawMaterialItemInput,
    type ItemRefRow,
} from '../repositories/openingBalanceRawMaterial.repository.js';
import type {
    CreateOpeningBalanceRawMaterialInput,
    ListOpeningBalanceRawMaterialQuery,
    OpeningBalanceRawMaterialItemInput,
    UpdateOpeningBalanceRawMaterialInput,
} from '../validations/openingBalanceRawMaterialValidation.js';

/** Resolves the linked brand/chemical/colour for an item and returns its display name alongside the matching item reference. */
async function resolveItem(item: OpeningBalanceRawMaterialItemInput, companyId: string): Promise<{ name: string; ref: ItemRefRow }> {
    switch (item.type) {
        case InventoryType.HDPE: {
            const name = await findLookupItemName('brands', item.brandId!, companyId);
            if (!name) throw new NotFoundError('Brand not found', 'BRAND_NOT_FOUND', { brandId: item.brandId });
            return { name, ref: { type: item.type, brandId: item.brandId! } };
        }
        case InventoryType.CHEMICAL: {
            const name = await findLookupItemName('chemicals', item.chemicalId!, companyId);
            if (!name) throw new NotFoundError('Chemical not found', 'CHEMICAL_NOT_FOUND', { chemicalId: item.chemicalId });
            return { name, ref: { type: item.type, chemicalId: item.chemicalId! } };
        }
        case InventoryType.COLOR: {
            const name = await findLookupItemName('colors', item.colorId!, companyId);
            if (!name) throw new NotFoundError('Color not found', 'COLOR_NOT_FOUND', { colorId: item.colorId });
            return { name, ref: { type: item.type, colorId: item.colorId! } };
        }
    }
}

export async function createOpeningBalanceRawMaterialGroup(input: CreateOpeningBalanceRawMaterialInput, companyId: string, actor: string) {
    const groupId = crypto.randomUUID();

    const resolvedItems = await Promise.all(input.items.map((item) => resolveItem(item, companyId)));

    const insertInputs: InsertRawMaterialItemInput[] = input.items.map((item, i) => ({
        companyId,
        groupId,
        name: resolvedItems[i]!.name,
        weightKg: item.weightKg,
        bagCount: item.bagCount,
        actor,
        date: input.date,
        ref: resolvedItems[i]!.ref,
    }));

    return createRawMaterialBatch(insertInputs);
}

export async function listOpeningBalanceRawMaterials(query: ListOpeningBalanceRawMaterialQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await listRawMaterialsRepo(companyId, { dateFrom: query.date_from, dateTo: query.date_to, type: query.type }, skip, take);
    return { items: rows, meta: toPageMeta(query, total) };
}

export async function replaceOpeningBalanceRawMaterialGroup(
    groupId: string,
    input: UpdateOpeningBalanceRawMaterialInput,
    companyId: string,
    actor: string,
) {
    const existing = await findRawMaterialGroupExisting(groupId, companyId);
    if (!existing) throw new NotFoundError('Opening balance group not found', 'OPENING_BALANCE_NOT_FOUND', { groupId });

    const resolvedItems = await Promise.all(input.items.map((item) => resolveItem(item, companyId)));

    const insertInputs: Omit<InsertRawMaterialItemInput, 'groupId'>[] = input.items.map((item, i) => ({
        companyId,
        name: resolvedItems[i]!.name,
        weightKg: item.weightKg,
        bagCount: item.bagCount,
        actor,
        date: input.date,
        ref: resolvedItems[i]!.ref,
    }));

    return replaceRawMaterialGroup(groupId, companyId, insertInputs);
}

export async function deleteOpeningBalanceRawMaterialGroup(groupId: string, companyId: string) {
    const groupIds = await findRawMaterialGroupIds(groupId, companyId);
    if (groupIds.length === 0) throw new NotFoundError('Opening balance group not found', 'OPENING_BALANCE_NOT_FOUND', { groupId });

    await deleteRawMaterialGroup(groupId, companyId);
}
