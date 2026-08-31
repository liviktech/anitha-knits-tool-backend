import { InventoryType, Prisma } from '@prisma/client';
import { ConflictError } from '../utils/errors.js';

/**
 * Inventory balances live in place on the existing `Inventory` row for each
 * item (one row per (companyId, type, item id) — not an append-only log).
 * `adjustInventoryBalance` is the only thing allowed to change `weightKg`:
 * it locks the item, reads the current balance, applies the signed delta,
 * and blocks the change if that would take the balance below zero.
 */

type ItemRef =
    | { type: typeof InventoryType.HDPE; brandId: string }
    | { type: typeof InventoryType.CHEMICAL; chemicalId: string }
    | { type: typeof InventoryType.COLOR; colorId: string };

export type AdjustInventoryBalanceInput = ItemRef & {
    companyId: string;
    /** Positive to add stock (intake, e.g. manual receipt), negative to consume it. */
    deltaKg: number;
    deltaBags?: number;
    actor: string;
    /** Used only if this item has no existing row yet. */
    name: string;
    /** Defaults to now if omitted. */
    date?: Date;
    /** Distribution Center */
    DC: string;
};

function roundKg(value: number): number {
    return Math.round(value * 1000) / 1000;
}

function itemWhere(input: ItemRef, companyId: string): Prisma.InventoryWhereInput {
    switch (input.type) {
        case InventoryType.HDPE:
            return { companyId, type: input.type, brandId: input.brandId };
        case InventoryType.CHEMICAL:
            return { companyId, type: input.type, chemicalId: input.chemicalId };
        case InventoryType.COLOR:
            return { companyId, type: input.type, colorId: input.colorId };
    }
}

function itemData(input: ItemRef): Pick<Prisma.InventoryUncheckedCreateInput, 'brandId' | 'chemicalId' | 'colorId'> {
    switch (input.type) {
        case InventoryType.HDPE:
            return { brandId: input.brandId };
        case InventoryType.CHEMICAL:
            return { chemicalId: input.chemicalId };
        case InventoryType.COLOR:
            return { colorId: input.colorId };
    }
}

function itemId(input: ItemRef): string {
    switch (input.type) {
        case InventoryType.HDPE:
            return input.brandId;
        case InventoryType.CHEMICAL:
            return input.chemicalId;
        case InventoryType.COLOR:
            return input.colorId;
    }
}

/**
 * Applies a signed delta to the current balance of one inventory item, inside
 * the caller's transaction. Serializes concurrent adjustments to the *same*
 * item via a Postgres advisory transaction lock (released automatically at
 * commit/rollback), so a read-then-write race can't push a balance negative
 * under concurrent requests.
 *
 * Time: O(1) — one lock, one lookup, one write.
 */
export async function adjustInventoryBalance(tx: Prisma.TransactionClient, input: AdjustInventoryBalanceInput): Promise<{ id: string }> {
    const { companyId, deltaKg, deltaBags, actor, name, date, DC } = input;
    const lockKey = `${companyId}:${input.type}:${itemId(input)}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const existing = await tx.inventory.findFirst({
        where: itemWhere(input, companyId),
        select: { id: true, weightKg: true, bagCount: true },
    });

    const currentKg = existing ? existing.weightKg.toNumber() : 0;
    const newBalance = roundKg(currentKg + deltaKg);
    const newBagCount = typeof deltaBags === 'number' ? ((existing?.bagCount || 0) + deltaBags) : undefined;

    if (newBalance < 0) {
        throw new ConflictError('Insufficient stock', 'INSUFFICIENT_STOCK', {
            type: input.type,
            itemId: itemId(input),
            available: currentKg,
            requested: roundKg(-deltaKg),
        });
    }

    if (existing) {
        await tx.inventory.update({
            where: { id: existing.id },
            data: { 
                weightKg: newBalance, 
                ...(newBagCount !== undefined ? { bagCount: Math.max(0, newBagCount) } : {}),
                updatedBy: actor, 
                ...(date ? { date } : {}) 
            },
        });
        return { id: existing.id };
    }

    const created = await tx.inventory.create({
        data: {
            companyId,
            type: input.type,
            name,
            weightKg: newBalance,
            ...(newBagCount !== undefined ? { bagCount: Math.max(0, newBagCount) } : {}),
            DC_NUMBER: DC,
            createdBy: actor,
            ...(date ? { date } : {}),
            ...itemData(input),
        },
        select: { id: true },
    });
    return { id: created.id };
}
