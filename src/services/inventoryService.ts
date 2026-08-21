import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type { CreateInventoryInput, UpdateInventoryInput, ListInventoryQuery } from '../validations/inventoryValidation.js';

const inventorySelect = {
    id: true,
    date: true,
    type: true,
    name: true,
    weightKg: true,
    createdAt: true,
    createdBy: true,
    updatedAt: true,
    updatedBy: true,
} satisfies Prisma.InventorySelect;

type InventoryRow = Prisma.InventoryGetPayload<{ select: typeof inventorySelect }>;

function mapInventoryRecord(record: InventoryRow) {
    return { ...record, weightKg: record.weightKg.toNumber() };
}

export async function createInventory(input: CreateInventoryInput, companyId: string, actor: string) {
    const record = await prisma.inventory.create({
        data: {
            companyId,
            date: input.date,
            type: input.type,
            name: input.name,
            weightKg: input.weightKg,
            createdBy: actor,
        },
        select: inventorySelect,
    });

    return mapInventoryRecord(record);
}

export async function listInventory(query: ListInventoryQuery, companyId: string) {
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
        ...(query.name ? { name: { contains: query.name, mode: 'insensitive' } } : {}),
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

    return { items: rows.map(mapInventoryRecord), meta: toPageMeta(query, total) };
}

export async function getInventoryById(id: string, companyId: string) {
    const record = await prisma.inventory.findFirst({ where: { id, companyId }, select: inventorySelect });
    if (!record) throw new NotFoundError('Inventory record not found', 'INVENTORY_NOT_FOUND', { id });
    return mapInventoryRecord(record);
}

export async function updateInventory(id: string, input: UpdateInventoryInput, companyId: string, actor: string) {
    const existing = await prisma.inventory.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!existing) throw new NotFoundError('Inventory record not found', 'INVENTORY_NOT_FOUND', { id });

    const record = await prisma.inventory.update({
        where: { id },
        data: {
            ...(input.date !== undefined ? { date: input.date } : {}),
            ...(input.type !== undefined ? { type: input.type } : {}),
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
            updatedBy: actor,
        },
        select: inventorySelect,
    });

    return mapInventoryRecord(record);
}

export async function deleteInventory(id: string, companyId: string) {
    const existing = await prisma.inventory.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!existing) throw new NotFoundError('Inventory record not found', 'INVENTORY_NOT_FOUND', { id });

    await prisma.inventory.delete({ where: { id } });
}
