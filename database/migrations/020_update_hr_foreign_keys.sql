-- ============================================================
-- Migration 020: Update HR & Payroll foreign keys to reference employees(id)
-- ============================================================

-- Clean up any orphaned records referencing employee_ids that no longer exist in employees table
DELETE FROM attendances WHERE employee_id NOT IN (SELECT id FROM employees);
DELETE FROM salary_advances WHERE employee_id NOT IN (SELECT id FROM employees);
DELETE FROM payroll_records WHERE employee_id NOT IN (SELECT id FROM employees);
DELETE FROM market_value_allocations WHERE employee_id NOT IN (SELECT id FROM employees);

-- 1. attendances
ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_employee_id_fkey;
ALTER TABLE attendances ADD CONSTRAINT attendances_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 2. salary_advances
ALTER TABLE salary_advances DROP CONSTRAINT IF EXISTS salary_advances_employee_id_fkey;
ALTER TABLE salary_advances ADD CONSTRAINT salary_advances_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 3. payroll_records
ALTER TABLE payroll_records DROP CONSTRAINT IF EXISTS payroll_records_employee_id_fkey;
ALTER TABLE payroll_records ADD CONSTRAINT payroll_records_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 4. market_value_allocations
ALTER TABLE market_value_allocations DROP CONSTRAINT IF EXISTS market_value_allocations_employee_id_fkey;
ALTER TABLE market_value_allocations ADD CONSTRAINT market_value_allocations_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE;
