-- ============================================================
-- Migration 021: Update market_value_deductions & other_deductions FKs to reference employees(id)
-- ============================================================

-- Clean up any orphaned records referencing employee_ids that no longer exist in employees table
DELETE FROM market_value_deductions WHERE employee_id NOT IN (SELECT id FROM employees);
DELETE FROM other_deductions WHERE employee_id NOT IN (SELECT id FROM employees);

-- 1. market_value_deductions
ALTER TABLE market_value_deductions DROP CONSTRAINT IF EXISTS market_value_deductions_employee_id_fkey;
ALTER TABLE market_value_deductions ADD CONSTRAINT market_value_deductions_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 2. other_deductions
ALTER TABLE other_deductions DROP CONSTRAINT IF EXISTS other_deductions_employee_id_fkey;
ALTER TABLE other_deductions ADD CONSTRAINT other_deductions_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE;
