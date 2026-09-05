-- ============================================================
-- Migration: Other deductions
-- Mirrors market_value_deductions (grant to one employee, single-payment,
-- effective month) but carries a free-text `name` — an ad-hoc deduction
-- reason/label that doesn't fit Salary Advance or Market Value.
-- ============================================================

CREATE TABLE IF NOT EXISTS other_deductions (
    id             UUID NOT NULL PRIMARY KEY,
    company_id     UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    employee_id    UUID NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    amount         NUMERIC(12, 2) NOT NULL,
    name           VARCHAR(200) NOT NULL,
    effective_date DATE NOT NULL,
    created_at     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by     VARCHAR(100) NOT NULL,
    updated_at     TIMESTAMPTZ(6) NOT NULL,
    updated_by     VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS other_deductions_company_id_effective_date_idx ON other_deductions (company_id, effective_date);
CREATE INDEX IF NOT EXISTS other_deductions_employee_id_idx ON other_deductions (employee_id);

ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS other_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0;
