-- ============================================================
-- Migration: Attendance, expenses, market value distribution, salary
-- advances, and computed payroll records
-- ============================================================

CREATE TABLE IF NOT EXISTS attendances (
    id          UUID NOT NULL PRIMARY KEY,
    company_id  UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    date        DATE NOT NULL,
    status      "AttendanceStatus" NOT NULL,
    remarks     VARCHAR(500),
    created_at  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by  VARCHAR(100),
    updated_at  TIMESTAMPTZ(6) NOT NULL,
    updated_by  VARCHAR(100),
    UNIQUE (company_id, employee_id, date)
);

CREATE TABLE IF NOT EXISTS expenses (
    id           UUID NOT NULL PRIMARY KEY,
    company_id   UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    -- Server-generated sequential id (EXP-001, EXP-002, ...) — see expenseService.generateExpenseId.
    expense_id   VARCHAR(20) NOT NULL,
    date         DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expense_name VARCHAR(150) NOT NULL,
    amount       NUMERIC(12, 2) NOT NULL,
    created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by   VARCHAR(100) NOT NULL,
    updated_at   TIMESTAMPTZ(6) NOT NULL,
    updated_by   VARCHAR(100),
    UNIQUE (company_id, expense_id)
);

CREATE TABLE IF NOT EXISTS market_value_distributions (
    id             UUID NOT NULL PRIMARY KEY,
    company_id     UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    effective_date DATE NOT NULL,
    total_pool     NUMERIC(12, 2) NOT NULL,
    created_at     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by     VARCHAR(100) NOT NULL,
    updated_at     TIMESTAMPTZ(6) NOT NULL,
    updated_by     VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS market_value_allocations (
    id              UUID NOT NULL PRIMARY KEY,
    distribution_id UUID NOT NULL REFERENCES market_value_distributions (id) ON UPDATE CASCADE ON DELETE CASCADE,
    employee_id     UUID NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    amount          NUMERIC(12, 2) NOT NULL,
    created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE IF NOT EXISTS salary_advances (
    id                UUID NOT NULL PRIMARY KEY,
    company_id        UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    employee_id       UUID NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    amount            NUMERIC(12, 2) NOT NULL,
    effective_date    DATE NOT NULL,
    repayment_method  VARCHAR(50) NOT NULL,
    -- EMI-only: both NULL for a single (one-shot) advance.
    total_months      INTEGER,
    emi_amount        NUMERIC(12, 2),
    created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        VARCHAR(100) NOT NULL,
    updated_at        TIMESTAMPTZ(6) NOT NULL,
    updated_by        VARCHAR(100)
);

-- Recomputed and overwritten wholesale per (company, month, year) by
-- payrollService.savePayrollRecords — never patched field-by-field.
CREATE TABLE IF NOT EXISTS payroll_records (
    id                    UUID NOT NULL PRIMARY KEY,
    company_id            UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    employee_id           UUID NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    month                 SMALLINT NOT NULL,
    year                  SMALLINT NOT NULL,
    base_salary           NUMERIC(12, 2) NOT NULL,
    total_days_in_month   SMALLINT NOT NULL,
    days_worked           NUMERIC(5, 2) NOT NULL,
    lop_deduction         NUMERIC(12, 2) NOT NULL,
    advance_deduction     NUMERIC(12, 2) NOT NULL,
    sunday_bonuses        NUMERIC(12, 2) NOT NULL,
    market_value_bonus    NUMERIC(12, 2) NOT NULL,
    gross_salary          NUMERIC(12, 2) NOT NULL,
    net_salary            NUMERIC(12, 2) NOT NULL,
    status                VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, PAID, etc.
    created_at            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ(6) NOT NULL,
    UNIQUE (employee_id, month, year)
);

CREATE INDEX IF NOT EXISTS attendances_company_id_date_idx ON attendances (company_id, date);
CREATE INDEX IF NOT EXISTS expenses_company_id_idx ON expenses (company_id);
CREATE INDEX IF NOT EXISTS expenses_company_id_date_idx ON expenses (company_id, date);
CREATE INDEX IF NOT EXISTS expenses_company_id_expense_name_idx ON expenses (company_id, expense_name);
CREATE INDEX IF NOT EXISTS market_value_distributions_company_id_effective_date_idx ON market_value_distributions (company_id, effective_date);
CREATE INDEX IF NOT EXISTS market_value_allocations_distribution_id_idx ON market_value_allocations (distribution_id);
CREATE INDEX IF NOT EXISTS market_value_allocations_employee_id_idx ON market_value_allocations (employee_id);
CREATE INDEX IF NOT EXISTS salary_advances_company_id_effective_date_idx ON salary_advances (company_id, effective_date);
CREATE INDEX IF NOT EXISTS salary_advances_employee_id_idx ON salary_advances (employee_id);
CREATE INDEX IF NOT EXISTS payroll_records_company_id_month_year_idx ON payroll_records (company_id, month, year);
