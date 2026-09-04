-- ============================================================
-- Migration: Link kora_ledger_entries to Opening Balance (Fabric Stock)
-- Lets an Opening Balance Fabric Stock record credit kora_balances through
-- the same ledger table Fabric Checking uses, keyed by its own column
-- (mirroring production_record_id) so create/update/delete can find and
-- reverse exactly the entry it created — see koraBalanceService.ts.
-- ============================================================

ALTER TABLE kora_ledger_entries
    ADD COLUMN IF NOT EXISTS opening_balance_id UUID UNIQUE REFERENCES opening_balance_fabric_stock (id) ON UPDATE CASCADE ON DELETE SET NULL;
