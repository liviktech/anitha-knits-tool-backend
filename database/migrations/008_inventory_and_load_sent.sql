-- ============================================================
-- Migration: Inventory intake and Load Sent (stock delivered)
-- ============================================================

-- Append-only intake log (see inventoryService.ts) — group_id ties together the rows from
-- one batch intake/edit; a bare brand/chemical/color reference identifies the item.
CREATE TABLE IF NOT EXISTS inventory (
    id          UUID NOT NULL PRIMARY KEY,
    company_id  UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    group_id    UUID,
    date        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type        "InventoryType" NOT NULL,
    "DC_NUMBER" TEXT NOT NULL,
    name        VARCHAR(150) NOT NULL,
    weight_kg   NUMERIC(12, 3) NOT NULL,
    bag_count   INTEGER,
    brand_id    UUID REFERENCES brands (id) ON UPDATE CASCADE ON DELETE SET NULL,
    chemical_id UUID REFERENCES chemicals (id) ON UPDATE CASCADE ON DELETE SET NULL,
    color_id    UUID REFERENCES colors (id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by  VARCHAR(100) NOT NULL,
    updated_at  TIMESTAMPTZ(6) NOT NULL,
    updated_by  VARCHAR(100)
);

-- production_record_id is set for a DELIVERY-stage entry created through the production
-- flow; the FK cascades (unlike wastage/kora), so deleting that production_records row
-- removes this one automatically — see loadSentService.deleteLoadSent.
CREATE TABLE IF NOT EXISTS load_sent (
    id                     UUID NOT NULL PRIMARY KEY,
    company_id             UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    production_record_id   UUID UNIQUE REFERENCES production_records (id) ON UPDATE CASCADE ON DELETE CASCADE,
    color_id               UUID NOT NULL REFERENCES colors (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    size_id                UUID NOT NULL REFERENCES sizes (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    fabric_weight          NUMERIC(12, 3) NOT NULL DEFAULT 0,
    fw_weight              NUMERIC(12, 3) NOT NULL DEFAULT 0,
    bw_weight              NUMERIC(12, 3) NOT NULL DEFAULT 0,
    total_wastage_weight   NUMERIC(12, 3) NOT NULL DEFAULT 0,
    driver_name            VARCHAR(100),
    vehicle_no             VARCHAR(20),
    created_at             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by             VARCHAR(100) NOT NULL,
    updated_at             TIMESTAMPTZ(6) NOT NULL,
    updated_by             VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS inventory_company_id_idx ON inventory (company_id);
CREATE INDEX IF NOT EXISTS inventory_group_id_idx ON inventory (group_id);
CREATE INDEX IF NOT EXISTS inventory_date_idx ON inventory (date);
CREATE INDEX IF NOT EXISTS inventory_type_idx ON inventory (type);
CREATE INDEX IF NOT EXISTS inventory_name_idx ON inventory (name);
CREATE INDEX IF NOT EXISTS load_sent_company_id_idx ON load_sent (company_id);
CREATE INDEX IF NOT EXISTS load_sent_color_id_idx ON load_sent (color_id);
CREATE INDEX IF NOT EXISTS load_sent_size_id_idx ON load_sent (size_id);
CREATE INDEX IF NOT EXISTS load_sent_production_record_id_idx ON load_sent (production_record_id);
