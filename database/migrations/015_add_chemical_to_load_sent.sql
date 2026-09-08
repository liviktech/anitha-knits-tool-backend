-- ============================================================
-- Migration: Chemical (optional) on Load Sent
-- Lets a Load Sent entry record which chemical's fabric was delivered,
-- mirroring extruder_details.chemical_id / loom_details.chemical_id /
-- fabric_check_details.chemical_id. Nullable at the DB level since existing
-- rows predate this field; the create form makes it required for new entries.
-- ============================================================

ALTER TABLE load_sent
    ADD COLUMN IF NOT EXISTS chemical_id UUID REFERENCES chemicals (id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS load_sent_chemical_id_idx ON load_sent (chemical_id);
