import { InventoryType, Prisma, RightAction, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { roundKg } from '../utils/decimal.js';
import { assertModuleActionAllowed } from './roleAccessService.js';
import crypto from 'crypto';

const INVENTORY_MODULE_CODE = 'inventory';
import type {
  CreateInventoryInput,
  UpdateInventoryInput,
  ListInventoryQuery,
  BatchCreateInventoryInput,
  BatchUpdateInventoryInput,
} from '../validations/inventoryValidation.js';

const inventorySelect = {
  id: true,
  groupId: true,
  date: true,
  type: true,
  name: true,
  weightKg: true,
  bagCount: true,
  DC_NUMBER: true,
  brand: { select: { id: true, name: true } },
  chemical: { select: { id: true, name: true } },
  color: { select: { id: true, name: true } },
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
} satisfies Prisma.InventorySelect;

type InventoryRow = Prisma.InventoryGetPayload<{
  select: typeof inventorySelect;
}>;

function mapInventoryRecord(record: InventoryRow) {
  return { ...record, weightKg: record.weightKg.toNumber() };
}

/** Resolves the linked brand/chemical/colour for an intake and returns its name (used only on first-ever intake of that item) alongside the matching item reference. */
async function resolveItem(input: Omit<CreateInventoryInput, 'date'>, companyId: string) {
  switch (input.type) {
    case InventoryType.HDPE: {
      const brand = await prisma.brand.findFirst({
        where: { id: input.brandId, companyId },
        select: { name: true },
      });
      if (!brand)
        throw new NotFoundError('Brand not found', 'BRAND_NOT_FOUND', {
          brandId: input.brandId,
        });
      return { name: brand.name, ref: { type: input.type, brandId: input.brandId! } };
    }
    case InventoryType.CHEMICAL: {
      const chemical = await prisma.chemical.findFirst({
        where: { id: input.chemicalId, companyId },
        select: { name: true },
      });
      if (!chemical)
        throw new NotFoundError('Chemical not found', 'CHEMICAL_NOT_FOUND', {
          chemicalId: input.chemicalId,
        });
      return { name: chemical.name, ref: { type: input.type, chemicalId: input.chemicalId! } };
    }
    case InventoryType.COLOR: {
      const color = await prisma.color.findFirst({
        where: { id: input.colorId, companyId },
        select: { name: true },
      });
      if (!color)
        throw new NotFoundError('Color not found', 'COLOR_NOT_FOUND', {
          colorId: input.colorId,
        });
      return { name: color.name, ref: { type: input.type, colorId: input.colorId! } };
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
    })
  );

  const createdRecords = await prisma.$transaction(async (tx) => {
    return Promise.all(
      resolvedItems.map(async (item) => {
        return tx.inventory.create({
          data: {
            companyId,
            groupId,
            name: item.name,
            weightKg: item.quantityKg,
            bagCount: item.bagCount,
            DC_NUMBER: item.DC,
            createdBy: actor,
            date,
            ...item.ref,
          },
          select: inventorySelect,
        });
      })
    );
  });

  return createdRecords.map(mapInventoryRecord);
}

export async function listInventory(
  query: ListInventoryQuery,
  companyId: string,
) {
  const { skip, take } = toSkipTake(query);

  const where: Prisma.InventoryWhereInput = {
    companyId,
    ...(query.date_from || query.date_to
      ? {
        date: {
          ...(query.date_from ? { gte: query.date_from } : {}),
          ...(query.date_to ? { lte: query.date_to } : {}),
        },
      }
      : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.name
      ? { name: { contains: query.name, mode: 'insensitive' } }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.inventory.findMany({
      where,
      select: inventorySelect,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    }),
    prisma.inventory.count({ where }),
  ]);

  return {
    items: rows.map(mapInventoryRecord),
    meta: toPageMeta(query, total),
  };
}

export async function getInventoryById(id: string, companyId: string) {
  const record = await prisma.inventory.findFirst({
    where: { id, companyId },
    select: inventorySelect,
  });
  if (!record)
    throw new NotFoundError(
      'Inventory record not found',
      'INVENTORY_NOT_FOUND',
      { id },
    );
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
    const existingGroup = await prisma.inventory.findFirst({
      where: { groupId: idOrGroupId, companyId },
    });
    if (!existingGroup) {
      throw new NotFoundError('Inventory group not found', 'INVENTORY_NOT_FOUND', { groupId: idOrGroupId });
    }

    const resolvedItems = await Promise.all(
      batchInput.items.map(async (item) => {
        const { name, ref } = await resolveItem(item, companyId);
        return { ...item, name, ref };
      })
    );

    const updatedRecords = await prisma.$transaction(async (tx) => {
      // Delete old records in this group
      await tx.inventory.deleteMany({
        where: { groupId: idOrGroupId, companyId },
      });

      // Insert new ones
      return Promise.all(
        resolvedItems.map(async (item) => {
          return tx.inventory.create({
            data: {
              companyId,
              groupId: idOrGroupId,
              name: item.name,
              weightKg: item.quantityKg,
              bagCount: item.bagCount,
              DC_NUMBER: item.DC,
              createdBy: existingGroup.createdBy,
              createdAt: existingGroup.createdAt,
              updatedBy: actor,
              date,
              ...item.ref,
            },
            select: inventorySelect,
          });
        })
      );
    });

    return updatedRecords.map(mapInventoryRecord);
  } else {
    // Single item update
    const singleInput = input as UpdateInventoryInput;
    const existing = await prisma.inventory.findFirst({
      where: { id: idOrGroupId, companyId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundError(
        'Inventory record not found',
        'INVENTORY_NOT_FOUND',
        { id: idOrGroupId },
      );

    const record = await prisma.inventory.update({
      where: { id: idOrGroupId },
      data: {
        ...(singleInput.date !== undefined ? { date: singleInput.date } : {}),
        ...(singleInput.weightKg !== undefined ? { weightKg: singleInput.weightKg } : {}),
        ...(singleInput.bagCount !== undefined ? { bagCount: singleInput.bagCount } : {}),
        ...(singleInput.DC !== undefined ? { DC_NUMBER: singleInput.DC } : {}),
        updatedBy: actor,
      },
      select: inventorySelect,
    });

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
export async function getInventorySummaryByDateRange(
  companyId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<Record<InventoryType, InventoryTypeSummary>> {
  const rows = await prisma.inventory.findMany({
    where: { companyId, date: { gte: dateFrom, lte: dateTo } },
    select: inventorySelect,
  });

  // Since we now have multiple rows per item (transaction log), we must aggregate them
  // by item ID to provide a summary of the current balance.
  const aggregated = new Map<string, Omit<InventoryRow, 'weightKg'> & { weightKg: number }>();
  
  for (const row of rows) {
    const key = `${row.type}-${row.name}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.weightKg += row.weightKg.toNumber();
      // Keep the most recent date
      if (row.date > existing.date) existing.date = row.date;
    } else {
      aggregated.set(key, { ...row, weightKg: row.weightKg.toNumber() } as any);
    }
  }

  const byType: Record<InventoryType, any[]> = {
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
  const groupRows = await prisma.inventory.findMany({
    where: { groupId: idOrGroupId, companyId },
    select: { id: true },
  });

  if (groupRows.length > 0) {
    await prisma.inventory.deleteMany({ where: { groupId: idOrGroupId, companyId } });
    return;
  }

  const existing = await prisma.inventory.findFirst({
    where: { id: idOrGroupId, companyId },
    select: { id: true },
  });
  if (!existing)
    throw new NotFoundError(
      'Inventory record not found',
      'INVENTORY_NOT_FOUND',
      { id: idOrGroupId },
    );

  await prisma.inventory.delete({ where: { id: idOrGroupId } });
}
