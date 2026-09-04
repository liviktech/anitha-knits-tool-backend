import type pg from 'pg';
import { KoraEntryType } from '../types/enums.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type { ListKoraLedgerQuery } from '../validations/koraBalanceValidation.js';
import {
    deleteKoraLedgerEntry,
    findKoraBalanceByVariant,
    findKoraLedgerEntryByOpeningBalanceRecord,
    findKoraLedgerEntryByProductionRecord,
    incrementKoraBalance,
    insertKoraLedgerEntry,
    insertOpeningBalanceKoraLedgerEntry,
    listKoraBalances as listKoraBalancesRepo,
    listKoraLedgerEntries,
    upsertKoraBalanceIncrement,
} from '../repositories/koraBalance.repository.js';

/**
 * Kora Balance Service
 *
 * Tracks fabric stock per color+size variant. Updated once, from Fabric
 * Checking: net = (latest Loom batch's fabric_output_kg) − (this check's
 * fabric_input_kg). One ledger entry per Fabric Checking record — CREDIT if
 * net is positive, DEBIT if negative.
 *
 * KoraBalance holds the *current* balance per variant.
 * KoraLedgerEntry is the append-only audit trail of every movement.
 */

// Matches the schema's Decimal(_, 3) precision (3 decimal places = milli-kg). Working in scaled
// integers (not floats) for the subtraction below is exact — no floating-point rounding error —
// which is what the original Prisma.Decimal arithmetic here guaranteed.
const KG_SCALE = 1000;

function toMilliKg(kg: number): number {
    return Math.round(kg * KG_SCALE);
}

/**
 * Updates kora balance for a color+size variant by the net of a Loom batch's
 * fabric output against a Fabric Checking's fabric input.
 * Called from fabricCheckingService.createFabricCheckingRecord within its transaction.
 * The balance write itself is always a single atomic upsert-increment statement (see
 * koraBalance.repository.upsertKoraBalanceIncrement) — never a JS-side read-then-write, which
 * would reintroduce the race that atomic upsert exists to prevent.
 */
export async function updateKoraBalance(
    companyId: string,
    colorId: string,
    sizeId: string,
    fabricOutputKg: number,
    fabricInputKg: number,
    productionDate: Date,
    productionRecordId: string,
    actor: string,
    client: pg.PoolClient,
) {
    const netMilliKg = toMilliKg(fabricOutputKg) - toMilliKg(fabricInputKg);
    const netKg = netMilliKg / KG_SCALE;

    const koraBalance = await upsertKoraBalanceIncrement(client, { companyId, colorId, sizeId, deltaKg: netKg });

    await insertKoraLedgerEntry(client, {
        koraBalanceId: koraBalance.id,
        entryType: netMilliKg < 0 ? KoraEntryType.DEBIT : KoraEntryType.CREDIT,
        stockDate: productionDate,
        productionRecordId,
        quantityKg: Math.abs(netMilliKg) / KG_SCALE,
        balanceAfterKg: koraBalance.balanceKg,
        actor,
    });
}

/**
 * Undoes the kora balance effect of a Fabric Checking record being deleted, using its
 * own ledger entry (not a fresh Loom lookup, which could have drifted since creation)
 * so the reversal is exact. Also removes the ledger entry itself — its productionRecordId
 * FK has no onDelete: Cascade, so it must be cleared before the production record it
 * points to can be deleted, the same way WastageRecord rows are.
 * Called from fabricCheckingService.deleteFabricCheckingRecord within its transaction,
 * before the production record itself is deleted. A no-op if no entry exists.
 */
export async function reverseKoraBalance(productionRecordId: string, client: pg.PoolClient) {
    const entry = await findKoraLedgerEntryByProductionRecord(productionRecordId, client);
    if (!entry) return;

    const deltaKg = entry.entryType === KoraEntryType.CREDIT ? -entry.quantityKg : entry.quantityKg;
    await incrementKoraBalance(client, entry.koraBalanceId, deltaKg);
    await deleteKoraLedgerEntry(client, entry.id);
}

/**
 * Credits kora_balances for an Opening Balance Fabric Stock record — the starting stock
 * figure entered once (per date/colour/size) when a company sets up the tool. Always a
 * CREDIT (koraBalanceKg is validated non-negative). A zero balance is a no-op: nothing to
 * credit, and skipping it avoids creating a phantom kora_balances row for a variant that
 * has no real stock yet.
 * Called from openingBalanceFabricStockService within its transaction.
 */
export async function applyOpeningBalanceKoraEffect(
    companyId: string,
    colorId: string,
    sizeId: string,
    koraBalanceKg: number,
    stockDate: Date,
    openingBalanceId: string,
    actor: string,
    client: pg.PoolClient,
) {
    if (koraBalanceKg <= 0) return;

    const koraBalance = await upsertKoraBalanceIncrement(client, { companyId, colorId, sizeId, deltaKg: koraBalanceKg });

    await insertOpeningBalanceKoraLedgerEntry(client, {
        koraBalanceId: koraBalance.id,
        entryType: KoraEntryType.CREDIT,
        stockDate,
        openingBalanceId,
        quantityKg: koraBalanceKg,
        balanceAfterKg: koraBalance.balanceKg,
        actor,
    });
}

/**
 * Undoes the kora balance effect of an Opening Balance Fabric Stock record being updated
 * or deleted, using its own ledger entry (not the record's current values, which may have
 * already changed) so the reversal is exact. A no-op if no entry exists — e.g. the record
 * never had a colour+size, or its koraBalanceKg was 0.
 * Called from openingBalanceFabricStockService within its transaction, before applying the
 * record's new effect (on update) or deleting it (on delete).
 */
export async function reverseOpeningBalanceKoraEffect(openingBalanceId: string, client: pg.PoolClient) {
    const entry = await findKoraLedgerEntryByOpeningBalanceRecord(client, openingBalanceId);
    if (!entry) return;

    const deltaKg = entry.entryType === KoraEntryType.CREDIT ? -entry.quantityKg : entry.quantityKg;
    await incrementKoraBalance(client, entry.koraBalanceId, deltaKg);
    await deleteKoraLedgerEntry(client, entry.id);
}

// ── Read-only queries ────────────────────────────────────────────────────

/**
 * List all kora balances (one per color+size variant) for a company.
 */
export async function listKoraBalances(companyId: string) {
    return listKoraBalancesRepo(companyId);
}

/**
 * Current balance for a single colour+size variant (0 if it has no kora_balances row yet).
 * Used by fabricCheckingService's create guard, on `client`, to match what the entry form's
 * Kora Stock figure showed when adding a new record.
 */
export async function getCurrentKoraBalanceKg(companyId: string, colorId: string, sizeId: string, client?: pg.PoolClient): Promise<number> {
    const balance = await findKoraBalanceByVariant(companyId, colorId, sizeId, client);
    return balance?.balanceKg ?? 0;
}

/**
 * Current balance for a colour+size variant with one specific production record's own ledger
 * effect subtracted back out — the same math reverseKoraBalance applies, just computed without
 * writing anything. Backs the Fabric Checking edit form's Kora Stock figure and its own update
 * guard: the record being edited already has its own CREDIT/DEBIT baked into the current
 * balance, so this is what the balance would be without it.
 *
 * Deliberately keyed off the record's own ledger entry rather than a "balance before its
 * production date" cutoff — a date cutoff would also hide any other movement dated the same
 * day (e.g. an Opening Balance entered for that date), understating what's really available.
 * A no-op reversal (record has no ledger entry — e.g. a brand-new id) just returns the current
 * balance unchanged.
 */
export async function getKoraBalanceExcludingRecord(
    companyId: string,
    colorId: string,
    sizeId: string,
    excludeProductionRecordId: string,
    client?: pg.PoolClient,
): Promise<number> {
    const balance = await findKoraBalanceByVariant(companyId, colorId, sizeId, client);
    if (!balance) return 0;

    const entry = await findKoraLedgerEntryByProductionRecord(excludeProductionRecordId, client);
    // Only subtract if the entry actually belongs to *this* variant's balance — if the record's
    // colour/size is being changed in the same update, its old entry (if any) sits against the
    // old variant's balance, not this one, so this variant's balance never included it.
    if (!entry || entry.koraBalanceId !== balance.id) return balance.balanceKg;

    const deltaKg = entry.entryType === KoraEntryType.CREDIT ? -entry.quantityKg : entry.quantityKg;
    return balance.balanceKg + deltaKg;
}

/**
 * Get paginated ledger entries for a specific color+size variant, scoped to the caller's company.
 */
export async function getKoraLedger(companyId: string, colorId: string, sizeId: string, query: ListKoraLedgerQuery) {
    const { skip, take } = toSkipTake(query);

    const koraBalance = await findKoraBalanceByVariant(companyId, colorId, sizeId);

    if (!koraBalance) {
        return {
            balance: { colorId, sizeId, balanceKg: 0 },
            items: [],
            meta: toPageMeta(query, 0),
        };
    }

    const { rows, total } = await listKoraLedgerEntries(koraBalance.id, { dateFrom: query.date_from, dateTo: query.date_to }, skip, take);

    return {
        balance: { colorId, sizeId, balanceKg: koraBalance.balanceKg },
        items: rows,
        meta: toPageMeta(query, total),
    };
}
