import crypto from 'crypto';
import { InventoryType, RightAction, UserRole } from '../types/enums.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { roundKg } from '../utils/decimal.js';
import { assertModuleActionAllowed } from './roleAccessService.js';
import { findLookupItemName } from '../repositories/lookupItem.repository.js';
import {
    createInventoryBatch,
    deleteInventoryGroup,
    deleteInventoryItem,
    existsInventoryInCompany,
    findInventoryById,
    findInventoryGroupExisting,
    findInventoryGroupIds,
    findInventoryRowsForSummary,
    listInventory as listInventoryRepo,
    replaceInventoryGroup,
    updateInventoryItem,
    type InventoryRow,
    type InsertInventoryItemInput,
    type ItemRefRow,
} from '../repositories/inventory.repository.js';
import type {
    CreateInventoryInput,
    UpdateInventoryInput,
    ListInventoryQuery,
    BatchCreateInventoryInput,
    BatchUpdateInventoryInput,
} from '../validations/inventoryValidation.js';

const INVENTORY_MODULE_CODE = 'inventory';

function mapInventoryRecord(record: InventoryRow) {
    return record;
}

/** Resolves the linked brand/chemical/colour for an intake and returns its name (used only on first-ever intake of that item) alongside the matching item reference. */
async function resolveItem(input: Omit<CreateInventoryInput, 'date'>, companyId: string): Promise<{ name: string; ref: ItemRefRow }> {
    switch (input.type) {
        case InventoryType.HDPE: {
            const name = await findLookupItemName('brands', input.brandId!, companyId);
            if (!name) throw new NotFoundError('Brand not found', 'BRAND_NOT_FOUND', { brandId: input.brandId });
            return { name, ref: { type: input.type, brandId: input.brandId! } };
        }
        case InventoryType.CHEMICAL: {
            const name = await findLookupItemName('chemicals', input.chemicalId!, companyId);
            if (!name) throw new NotFoundError('Chemical not found', 'CHEMICAL_NOT_FOUND', { chemicalId: input.chemicalId });
            return { name, ref: { type: input.type, chemicalId: input.chemicalId! } };
        }
        case InventoryType.COLOR: {
            const name = await findLookupItemName('colors', input.colorId!, companyId);
            if (!name) throw new NotFoundError('Color not found', 'COLOR_NOT_FOUND', { colorId: input.colorId });
            return { name, ref: { type: input.type, colorId: input.colorId! } };
        }
    }
}

export async function createInventory(
    input: CreateInventoryInput | BatchCreateInventoryInput,
    companyId: string,
    actor: string,
    callerRole: UserRole,
    callerId: string,
) {
    await assertModuleActionAllowed(callerRole, callerId, companyId, INVENTORY_MODULE_CODE, RightAction.ADD);

    const isBatch = 'items' in input;
    const items = isBatch ? (input as BatchCreateInventoryInput).items : [input as CreateInventoryInput];
    const date = (input as any).date || new Date();
    const groupId = crypto.randomUUID();

    const resolvedItems = await Promise.all(
        items.map(async (item) => {
            const { name, ref } = await resolveItem(item, companyId);
            return { ...item, name, ref };
        }),
    );

    const insertInputs: InsertInventoryItemInput[] = resolvedItems.map((item) => ({
        companyId,
        groupId,
        name: item.name,
        weightKg: item.quantityKg,
        bagCount: item.bagCount,
        DC_NUMBER: item.DC,
        actor,
        date,
        ref: item.ref,
    }));

    const createdRecords = await createInventoryBatch(insertInputs);

    return createdRecords.map(mapInventoryRecord);
}

export async function listInventory(query: ListInventoryQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await listInventoryRepo(companyId, { dateFrom: query.date_from, dateTo: query.date_to, type: query.type, name: query.name }, skip, take);

    return { items: rows.map(mapInventoryRecord), meta: toPageMeta(query, total) };
}

export async function getInventoryById(id: string, companyId: string) {
    const record = await findInventoryById(id, companyId);
    if (!record) throw new NotFoundError('Inventory record not found', 'INVENTORY_NOT_FOUND', { id });
    return mapInventoryRecord(record);
}

export async function updateInventory(
    idOrGroupId: string,
    input: UpdateInventoryInput | BatchUpdateInventoryInput,
    companyId: string,
    actor: string,
    callerRole: UserRole,
    callerId: string,
) {
    await assertModuleActionAllowed(callerRole, callerId, companyId, INVENTORY_MODULE_CODE, RightAction.EDIT);

    const isBatch = 'items' in input;

    if (isBatch) {
        const batchInput = input as BatchUpdateInventoryInput;
        const date = batchInput.date || new Date();

        // First, verify the group exists
        const existingGroup = await findInventoryGroupExisting(idOrGroupId, companyId);
        if (!existingGroup) {
            throw new NotFoundError('Inventory group not found', 'INVENTORY_NOT_FOUND', { groupId: idOrGroupId });
        }

        const resolvedItems = await Promise.all(
            batchInput.items.map(async (item) => {
                const { name, ref } = await resolveItem(item, companyId);
                return { ...item, name, ref };
            }),
        );

        const insertInputs: Omit<InsertInventoryItemInput, 'groupId'>[] = resolvedItems.map((item) => ({
            companyId,
            name: item.name,
            weightKg: item.quantityKg,
            bagCount: item.bagCount,
            DC_NUMBER: item.DC,
            actor,
            date,
            ref: item.ref,
        }));

        const updatedRecords = await replaceInventoryGroup(idOrGroupId, companyId, insertInputs);

        return updatedRecords.map(mapInventoryRecord);
    } else {
        // Single item update
        const singleInput = input as UpdateInventoryInput;
        const existing = await existsInventoryInCompany(idOrGroupId, companyId);
        if (!existing) throw new NotFoundError('Inventory record not found', 'INVENTORY_NOT_FOUND', { id: idOrGroupId });

        const record = await updateInventoryItem(
            idOrGroupId,
            { date: singleInput.date, weightKg: singleInput.weightKg, bagCount: singleInput.bagCount, DC_NUMBER: singleInput.DC },
            actor,
        );

        return mapInventoryRecord(record);
    }
}

export type InventoryTypeSummary = {
    type: InventoryType;
    items: ReturnType<typeof mapInventoryRecord>[];
    totalWeightKg: number;
};

/**
 * Inventory balances for a date range, grouped by type (HDPE/CHEMICAL/COLOR)
 * with a per-type total — backs the dashboard's monthly inventory panel.
 */
export async function getInventorySummaryByDateRange(companyId: string, dateFrom: Date, dateTo: Date): Promise<Record<InventoryType, InventoryTypeSummary>> {
    const rows = await findInventoryRowsForSummary(companyId, dateFrom, dateTo);

    // Since we now have multiple rows per item (transaction log), we must aggregate them
    // by item ID to provide a summary of the current balance.
    const aggregated = new Map<string, InventoryRow>();

    for (const row of rows) {
        const key = `${row.type}-${row.name}`;
        const existing = aggregated.get(key);
        if (existing) {
            existing.weightKg += row.weightKg;
            // Keep the most recent date
            if (row.date > existing.date) existing.date = row.date;
        } else {
            aggregated.set(key, { ...row });
        }
    }

    const byType: Record<InventoryType, InventoryRow[]> = {
        [InventoryType.HDPE]: [],
        [InventoryType.CHEMICAL]: [],
        [InventoryType.COLOR]: [],
    };

    for (const row of aggregated.values()) {
        byType[row.type].push(row);
    }

    function summarize(type: InventoryType): InventoryTypeSummary {
        const items = byType[type];
        return { type, items, totalWeightKg: roundKg(items.reduce((sum, item) => sum + item.weightKg, 0)) };
    }

    return {
        [InventoryType.HDPE]: summarize(InventoryType.HDPE),
        [InventoryType.CHEMICAL]: summarize(InventoryType.CHEMICAL),
        [InventoryType.COLOR]: summarize(InventoryType.COLOR),
    };
}

export async function deleteInventory(idOrGroupId: string, companyId: string, callerRole: UserRole, callerId: string) {
    await assertModuleActionAllowed(callerRole, callerId, companyId, INVENTORY_MODULE_CODE, RightAction.DELETE);

    // Check if it's a groupId first
    const groupIds = await findInventoryGroupIds(idOrGroupId, companyId);

    if (groupIds.length > 0) {
        await deleteInventoryGroup(idOrGroupId, companyId);
        return;
    }

    const existing = await existsInventoryInCompany(idOrGroupId, companyId);
    if (!existing) throw new NotFoundError('Inventory record not found', 'INVENTORY_NOT_FOUND', { id: idOrGroupId });

    await deleteInventoryItem(idOrGroupId);
}
