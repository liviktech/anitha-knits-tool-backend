-- ============================================================
-- Migration: Chemical (optional) on Looms and Fabric Checking
-- Lets a Looms / Fabric Checking entry record which chemical was used,
-- mirroring extruder_details.chemical_id. Nullable/optional here (unlike
-- extruder's required chemical_id) since existing rows predate this field
-- and it isn't a required input on those two entry forms.
-- ============================================================

ALTER TABLE loom_details
    ADD COLUMN IF NOT EXISTS chemical_id UUID REFERENCES chemicals (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE fabric_check_details
    ADD COLUMN IF NOT EXISTS chemical_id UUID REFERENCES chemicals (id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS loom_details_chemical_id_idx ON loom_details (chemical_id);
CREATE INDEX IF NOT EXISTS fabric_check_details_chemical_id_idx ON fabric_check_details (chemical_id);
