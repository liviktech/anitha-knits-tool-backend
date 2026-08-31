-- kora_balances/kora_ledger_entries were never tracked in migration history (added via
-- schema-only/db push at some point), so this migration is hand-written and must be applied
-- with `prisma migrate deploy` rather than `prisma migrate dev` — dev's shadow-DB diffing would
-- try to (re)create these already-existing tables and could trigger a drift-reset prompt.

-- AlterTable: add company_id nullable first — existing rows are backfilled below before it's
-- made required.
ALTER TABLE "kora_balances" ADD COLUMN     "company_id" UUID;

-- Backfill: a kora_balances row's color already belongs to exactly one company, so derive
-- company_id from colors.company_id.
UPDATE "kora_balances" kb
SET company_id = c.company_id
FROM "colors" c
WHERE kb.color_id = c.id;

-- Now that every existing row has a value, enforce NOT NULL, the FK, and an index for
-- company-scoped lookups (listKoraBalances / getKoraLedger).
ALTER TABLE "kora_balances" ALTER COLUMN "company_id" SET NOT NULL;

ALTER TABLE "kora_balances" ADD CONSTRAINT "kora_balances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "kora_balances_company_id_idx" ON "kora_balances"("company_id");
