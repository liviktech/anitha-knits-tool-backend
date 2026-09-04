-- ============================================================
-- Migration: Expense names lookup table
-- Company-scoped master data backing the expense-name dropdown on the
-- Employee Expenses screen (previously a hardcoded frontend list). Mirrors
-- brands/chemicals/colors/sizes (003_master_data.sql) — item_code is
-- server-generated (prefix "EN" + companies.expense_name_seq), never
-- client-supplied. Does not FK expenses.expense_name (kept as free text,
-- same as other lookup-backed name fields) so historical expense records
-- are unaffected by renames/deletes here.
-- ============================================================

ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS expense_name_seq INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS expense_names (
    id         UUID NOT NULL PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    name       VARCHAR(150) NOT NULL,
    item_code  VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_at TIMESTAMPTZ(6) NOT NULL,
    updated_by VARCHAR(100),
    UNIQUE (company_id, name),
    UNIQUE (company_id, item_code)
);

CREATE INDEX IF NOT EXISTS expense_names_company_id_idx ON expense_names (company_id);
