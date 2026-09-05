-- ============================================================
-- Migration: Chemical (optional) on Opening Balance Wastage and Fabric Stock
-- Lets an opening-balance Wastage / Fabric Stock row record which chemical it
-- relates to, mirroring 012_add_chemical_to_looms_and_fabric_checking.sql.
-- Nullable/optional here since existing rows predate this field and it isn't
-- always attributable to a specific chemical at opening-balance time.
-- ============================================================

ALTER TABLE opening_balance_wastage
    ADD COLUMN IF NOT EXISTS chemical_id UUID REFERENCES chemicals (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE opening_balance_fabric_stock
    ADD COLUMN IF NOT EXISTS chemical_id UUID REFERENCES chemicals (id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS opening_balance_wastage_chemical_id_idx ON opening_balance_wastage (chemical_id);
CREATE INDEX IF NOT EXISTS opening_balance_fabric_stock_chemical_id_idx ON opening_balance_fabric_stock (chemical_id);
