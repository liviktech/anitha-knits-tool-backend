import type pg from 'pg';
import { KoraEntryType } from '../types/enums.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type { ListKoraLedgerQuery } from '../validations/koraBalanceValidation.js';
import {
    deleteKoraLedgerEntry,
    findKoraBalanceByVariant,
    findKoraLedgerEntryByProductionRecord,
    incrementKoraBalance,
    insertKoraLedgerEntry,
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
    const entry = await findKoraLedgerEntryByProductionRecord(client, productionRecordId);
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
