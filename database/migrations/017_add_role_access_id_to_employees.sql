-- ============================================================
-- Migration: Add role_access_id to employees table
-- ============================================================

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS role_access_id UUID REFERENCES role_access (id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS employees_role_access_id_idx ON employees (role_access_id);
