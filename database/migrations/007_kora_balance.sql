-- ============================================================
-- Migration: Kora balance (fabric stock per colour+size variant)
-- Updated once, from Fabric Checking: net = latest Loom batch's fabric
-- output − this check's fabric input. kora_balances holds the *current*
-- balance; kora_ledger_entries is the append-only audit trail.
-- ============================================================

-- company_id is nullable by design (not part of the unique key below) — balance identity
-- is (color_id, size_id) alone; see koraBalanceService.ts.
CREATE TABLE IF NOT EXISTS kora_balances (
    id         UUID NOT NULL PRIMARY KEY,
    company_id UUID REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    color_id   UUID NOT NULL REFERENCES colors (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    size_id    UUID NOT NULL REFERENCES sizes (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    balance_kg NUMERIC(14, 3) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ(6) NOT NULL,
    UNIQUE (color_id, size_id)
);

-- No onDelete cascade to production_records — must be deleted explicitly before the
-- parent record (see fabricCheckingService.deleteFabricCheckingRecord).
CREATE TABLE IF NOT EXISTS kora_ledger_entries (
    id                    UUID NOT NULL PRIMARY KEY,
    kora_balance_id       UUID NOT NULL REFERENCES kora_balances (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    entry_type            "KoraEntryType" NOT NULL,
    stock_date            DATE NOT NULL,
    production_record_id  UUID UNIQUE REFERENCES production_records (id) ON UPDATE CASCADE ON DELETE SET NULL,
    quantity_kg           NUMERIC(12, 3) NOT NULL,
    balance_after_kg      NUMERIC(14, 3) NOT NULL,
    created_at            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by            VARCHAR(100) NOT NULL
);

CREATE INDEX IF NOT EXISTS kora_balances_company_id_idx ON kora_balances (company_id);
CREATE INDEX IF NOT EXISTS kora_ledger_entries_kora_balance_id_created_at_idx ON kora_ledger_entries (kora_balance_id, created_at);
