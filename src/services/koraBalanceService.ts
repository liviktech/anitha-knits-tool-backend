import { Prisma, KoraEntryType } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type { ListKoraLedgerQuery } from '../validations/koraBalanceValidation.js';
import { Decimal } from '@prisma/client/runtime/wasm-compiler-edge';

/**
 * Kora Balance Service
 *
 * Tracks fabric stock per color+size variant:
 *   - CREDIT: Looms produces fabric_output_kg → adds to balance
 *   - DEBIT:  Fabric Checking consumes fabric_input_kg → subtracts from balance
 *
 * KoraBalance holds the *current* balance per variant.
 * KoraLedgerEntry is the append-only audit trail of every movement.
 */

type TxClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Credit kora balance when Looms produces fabric output.
 * Called from loomsService.createLoomsProduction within its transaction.
 */
export async function creditKoraBalance(
    colorId: string,
    sizeId: string,
    fabricOutputKg: number | Prisma.Decimal,
    productionDate: Date,
    productionRecordId: string,
    actor: string,
    tx: TxClient,
) {
    const qty = new Prisma.Decimal(fabricOutputKg.toString());

    // Upsert: create KoraBalance for new variant, or increment existing
    const koraBalance = await tx.koraBalance.upsert({
        where: { colorId_sizeId: { colorId, sizeId } },
        create: {
            colorId,
            sizeId,
            balanceKg: qty,
        },
        update: {
            balanceKg: { increment: qty },
        },
    });

    // Create ledger entry
    await tx.koraLedgerEntry.create({
        data: {
            koraBalanceId: koraBalance.id,
            entryType: KoraEntryType.CREDIT,
            stockDate: productionDate,
            productionRecordId,
            quantityKg: qty,
            balanceAfterKg: koraBalance.balanceKg,
            createdBy: actor,
        },
    });
}

/**
 * Debit kora balance when Fabric Checking consumes fabric.
 * Called from fabricCheckingService.createFabricCheckingRecord within its transaction.
 */
export async function debitKoraBalance(
    colorId: string,
    sizeId: string,
    fabricInputKg: number | Prisma.Decimal,
    productionDate: Date,
    productionRecordId: string,
    actor: string,
    tx: TxClient,
) {
    const qty = new Prisma.Decimal(fabricInputKg.toString());

    // Upsert: create KoraBalance for new variant (starts at 0, goes negative),
    // or decrement existing
    const koraBalance = await tx.koraBalance.upsert({
        where: { colorId_sizeId: { colorId, sizeId } },
        create: {
            colorId,
            sizeId,
            balanceKg: qty.negated(),
        },
        update: {
            balanceKg: { decrement: qty },
        },
    });

    // Create ledger entry
    await tx.koraLedgerEntry.create({
        data: {
            koraBalanceId: koraBalance.id,
            entryType: KoraEntryType.DEBIT,
            stockDate: productionDate,
            productionRecordId,
            quantityKg: qty,
            balanceAfterKg: koraBalance.balanceKg,
            createdBy: actor,
        },
    });
}

// ── Read-only queries ────────────────────────────────────────────────────

const koraBalanceSelect = {
    id: true,
    color: { select: { id: true, name: true } },
    size: { select: { id: true, name: true } },
    balanceKg: true,
    updatedAt: true,
} satisfies Prisma.KoraBalanceSelect;

type KoraBalanceRow = Prisma.KoraBalanceGetPayload<{ select: typeof koraBalanceSelect }>;

function mapKoraBalance(row: KoraBalanceRow) {
    return {
        id: row.id,
        color: row.color,
        size: row.size,
        balanceKg: row.balanceKg.toNumber(),
        updatedAt: row.updatedAt,
    };
}

/**
 * List all kora balances (one per color+size variant).
 */
export async function listKoraBalances() {
    const rows = await prisma.koraBalance.findMany({
        select: koraBalanceSelect,
        orderBy: [{ color: { name: 'asc' } }, { size: { name: 'asc' } }],
    });
    return rows.map(mapKoraBalance);
}

const ledgerSelect = {
    id: true,
    entryType: true,
    stockDate: true,
    quantityKg: true,
    balanceAfterKg: true,
    productionRecordId: true,
    createdAt: true,
    createdBy: true,
} satisfies Prisma.KoraLedgerEntrySelect;

type LedgerRow = Prisma.KoraLedgerEntryGetPayload<{ select: typeof ledgerSelect }>;

function mapLedgerEntry(row: LedgerRow) {
    return {
        id: row.id,
        entryType: row.entryType,
        stockDate: row.stockDate,
        quantityKg: row.quantityKg.toNumber(),
        balanceAfterKg: row.balanceAfterKg.toNumber(),
        productionRecordId: row.productionRecordId,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
    };
}

/**
 * Get paginated ledger entries for a specific color+size variant.
 */
export async function getKoraLedger(colorId: string, sizeId: string, query: ListKoraLedgerQuery) {
    const { skip, take } = toSkipTake(query);

    const koraBalance = await prisma.koraBalance.findUnique({
        where: { colorId_sizeId: { colorId, sizeId } },
        select: { id: true, balanceKg: true },
    });

    if (!koraBalance) {
        return {
            balance: { colorId, sizeId, balanceKg: 0 },
            items: [],
            meta: toPageMeta(query, 0),
        };
    }

    const where: Prisma.KoraLedgerEntryWhereInput = {
        koraBalanceId: koraBalance.id,
        ...(query.date_from || query.date_to
            ? {
                stockDate: {
                    ...(query.date_from ? { gte: query.date_from } : {}),
                    ...(query.date_to ? { lte: query.date_to } : {}),
                },
            }
            : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.koraLedgerEntry.findMany({
            where,
            select: ledgerSelect,
            orderBy: [{ stockDate: 'desc' }, { createdAt: 'desc' }],
            skip,
            take,
        }),
        prisma.koraLedgerEntry.count({ where }),
    ]);

    return {
        balance: { colorId, sizeId, balanceKg: koraBalance.balanceKg.toNumber() },
        items: rows.map(mapLedgerEntry),
        meta: toPageMeta(query, total),
    };
}
