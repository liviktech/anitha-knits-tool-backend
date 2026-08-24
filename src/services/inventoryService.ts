import { InventoryType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { adjustInventoryBalance } from './inventoryBalanceService.js';
import type {
  CreateInventoryInput,
  UpdateInventoryInput,
  ListInventoryQuery,
} from '../validations/inventoryValidation.js';

const inventorySelect = {
  id: true,
  date: true,
  type: true,
  name: true,
  weightKg: true,
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
async function resolveItem(input: CreateInventoryInput, companyId: string) {
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
  input: CreateInventoryInput,
  companyId: string,
  actor: string,
) {
  const { name, ref } = await resolveItem(input, companyId);

  const { id } = await prisma.$transaction((tx) =>
    adjustInventoryBalance(tx, {
      ...ref,
      companyId,
      deltaKg: input.quantityKg,
      actor,
      name,
      date: input.date,
    }),
  );

  return getInventoryById(id, companyId);
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
  id: string,
  input: UpdateInventoryInput,
  companyId: string,
  actor: string,
) {
  const existing = await prisma.inventory.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!existing)
    throw new NotFoundError(
      'Inventory record not found',
      'INVENTORY_NOT_FOUND',
      { id },
    );

  const record = await prisma.inventory.update({
    where: { id },
    data: {
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
      updatedBy: actor,
    },
    select: inventorySelect,
  });

  return mapInventoryRecord(record);
}

export async function deleteInventory(id: string, companyId: string) {
  const existing = await prisma.inventory.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!existing)
    throw new NotFoundError(
      'Inventory record not found',
      'INVENTORY_NOT_FOUND',
      { id },
    );

  await prisma.inventory.delete({ where: { id } });
}
