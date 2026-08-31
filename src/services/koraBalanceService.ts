import { Prisma, KoraEntryType } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type { ListKoraLedgerQuery } from '../validations/koraBalanceValidation.js';
import { Decimal } from '@prisma/client/runtime/wasm-compiler-edge';

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

type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Updates kora balance for a color+size variant by the net of a Loom batch's
 * fabric output against a Fabric Checking's fabric input.
 * Called from fabricCheckingService.createFabricCheckingRecord within its transaction.
 */
export async function updateKoraBalance(
  companyId: string,
  colorId: string,
  sizeId: string,
  fabricOutputKg: number | Prisma.Decimal,
  fabricInputKg: number | Prisma.Decimal,
  productionDate: Date,
  productionRecordId: string,
  actor: string,
  tx: TxClient,
) {
  const netQty = new Prisma.Decimal(fabricOutputKg.toString()).minus(
    fabricInputKg.toString(),
  );

  const koraBalance = await tx.koraBalance.upsert({
    where: { colorId_sizeId: { colorId, sizeId } },
    create: {
      companyId,
      colorId,
      sizeId,
      balanceKg: netQty,
    },
    update: {
      balanceKg: { increment: netQty },
    },
  });

  await tx.koraLedgerEntry.create({
    data: {
      koraBalanceId: koraBalance.id,
      entryType: netQty.isNegative()
        ? KoraEntryType.DEBIT
        : KoraEntryType.CREDIT,
      stockDate: productionDate,
      productionRecordId,
      quantityKg: netQty.abs(),
      balanceAfterKg: koraBalance.balanceKg,
      createdBy: actor,
    },
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
export async function reverseKoraBalance(
  productionRecordId: string,
  tx: TxClient,
) {
  const entry = await tx.koraLedgerEntry.findUnique({
    where: { productionRecordId },
    select: {
      id: true,
      koraBalanceId: true,
      entryType: true,
      quantityKg: true,
    },
  });
  if (!entry) return;

  const delta =
    entry.entryType === KoraEntryType.CREDIT
      ? entry.quantityKg.negated()
      : entry.quantityKg;
  await tx.koraBalance.update({
    where: { id: entry.koraBalanceId },
    data: { balanceKg: { increment: delta } },
  });
  await tx.koraLedgerEntry.delete({ where: { id: entry.id } });
}

// ── Read-only queries ────────────────────────────────────────────────────

const koraBalanceSelect = {
  id: true,
  color: { select: { id: true, name: true } },
  size: { select: { id: true, name: true } },
  balanceKg: true,
  updatedAt: true,
} satisfies Prisma.KoraBalanceSelect;

type KoraBalanceRow = Prisma.KoraBalanceGetPayload<{
  select: typeof koraBalanceSelect;
}>;

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
 * List all kora balances (one per color+size variant) for a company.
 */
export async function listKoraBalances(companyId: string) {
  const rows = await prisma.koraBalance.findMany({
    where: { companyId },
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

type LedgerRow = Prisma.KoraLedgerEntryGetPayload<{
  select: typeof ledgerSelect;
}>;

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
 * Get paginated ledger entries for a specific color+size variant, scoped to the caller's company.
 */
export async function getKoraLedger(
  companyId: string,
  colorId: string,
  sizeId: string,
  query: ListKoraLedgerQuery,
) {
  const { skip, take } = toSkipTake(query);

  const koraBalance = await prisma.koraBalance.findFirst({
    where: { companyId, colorId, sizeId },
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
