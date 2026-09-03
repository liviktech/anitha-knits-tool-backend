import type pg from 'pg';
import { ConflictError } from '../utils/errors.js';
import {
    acquireAdvisoryLock,
    findExistingBalance,
    insertBalanceRow,
    itemId,
    updateBalanceRow,
    type ItemRef,
} from '../repositories/inventoryBalance.repository.js';

/**
 * Inventory balances live in place on the existing `Inventory` row for each
 * item (one row per (companyId, type, item id) — not an append-only log).
 * `adjustInventoryBalance` is the only thing allowed to change `weightKg`:
 * it locks the item, reads the current balance, applies the signed delta,
 * and blocks the change if that would take the balance below zero.
 */

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

/**
 * Applies a signed delta to the current balance of one inventory item, inside
 * the caller's transaction. Serializes concurrent adjustments to the *same*
 * item via a Postgres advisory transaction lock (released automatically at
 * commit/rollback), so a read-then-write race can't push a balance negative
 * under concurrent requests.
 *
 * Time: O(1) — one lock, one lookup, one write.
 */
export async function adjustInventoryBalance(client: pg.PoolClient, input: AdjustInventoryBalanceInput): Promise<{ id: string }> {
    const { companyId, deltaKg, deltaBags, actor, name, date, DC } = input;
    const lockKey = `${companyId}:${input.type}:${itemId(input)}`;
    await acquireAdvisoryLock(client, lockKey);

    const existing = await findExistingBalance(client, companyId, input);

    const currentKg = existing ? existing.weightKg : 0;
    const newBalance = roundKg(currentKg + deltaKg);
    const newBagCount = typeof deltaBags === 'number' ? (existing?.bagCount || 0) + deltaBags : undefined;

    if (newBalance < 0) {
        throw new ConflictError('Insufficient stock', 'INSUFFICIENT_STOCK', {
            type: input.type,
            itemId: itemId(input),
            available: currentKg,
            requested: roundKg(-deltaKg),
        });
    }

    if (existing) {
        await updateBalanceRow(client, existing.id, {
            weightKg: newBalance,
            ...(newBagCount !== undefined ? { bagCount: Math.max(0, newBagCount) } : {}),
            actor,
            ...(date ? { date } : {}),
        });
        return { id: existing.id };
    }

    return insertBalanceRow(client, {
        companyId,
        ref: input,
        name,
        weightKg: newBalance,
        ...(newBagCount !== undefined ? { bagCount: Math.max(0, newBagCount) } : {}),
        DC,
        actor,
        date,
    });
}
