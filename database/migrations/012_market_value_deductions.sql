-- ============================================================
-- Migration: Market Value deductions
-- Mirrors salary_advances (grant to one employee, effective month) but
-- single-payment only — no EMI/repayment_method — since a market value
-- deduction is always taken from the one payroll run it's effective in.
-- ============================================================

CREATE TABLE IF NOT EXISTS market_value_deductions (
    id             UUID NOT NULL PRIMARY KEY,
    company_id     UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    employee_id    UUID NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    amount         NUMERIC(12, 2) NOT NULL,
    effective_date DATE NOT NULL,
    created_at     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by     VARCHAR(100) NOT NULL,
    updated_at     TIMESTAMPTZ(6) NOT NULL,
    updated_by     VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS market_value_deductions_company_id_effective_date_idx ON market_value_deductions (company_id, effective_date);
CREATE INDEX IF NOT EXISTS market_value_deductions_employee_id_idx ON market_value_deductions (employee_id);

ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS market_value_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0;
