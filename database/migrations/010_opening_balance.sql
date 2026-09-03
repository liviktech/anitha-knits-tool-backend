-- ============================================================
-- Migration: Opening Balance (Raw Materials, Wastage, Fabric Stock)
-- ============================================================
-- Backs the Admin Panel's "Opening Balance" tabs — the starting stock figures entered once
-- (per date) when a company first sets up the tool, kept separate from the day-to-day
-- production/inventory tables so they can never be double-counted into a live running balance.

-- Raw Materials (HDPE/Chemicals/Colors) — one row per item, batched together under one group_id
-- per date, mirroring the `inventory` table's own shape (see 008_inventory_and_load_sent.sql).
CREATE TABLE IF NOT EXISTS opening_balance_raw_materials (
    id          UUID NOT NULL PRIMARY KEY,
    company_id  UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    group_id    UUID NOT NULL,
    date        DATE NOT NULL,
    type        "InventoryType" NOT NULL,
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

-- Wastage — one row per (date, color, size); color/size are optional since wastage isn't always
-- attributable to a specific variant at opening-balance time.
CREATE TABLE IF NOT EXISTS opening_balance_wastage (
    id                       UUID NOT NULL PRIMARY KEY,
    company_id               UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    date                     DATE NOT NULL,
    color_id                 UUID REFERENCES colors (id) ON UPDATE CASCADE ON DELETE SET NULL,
    size_id                  UUID REFERENCES sizes (id) ON UPDATE CASCADE ON DELETE SET NULL,
    extruder_lumps_kg        NUMERIC(12, 3) NOT NULL DEFAULT 0,
    extruder_looms_waste_kg  NUMERIC(12, 3) NOT NULL DEFAULT 0,
    looms_yarn_waste_kg      NUMERIC(12, 3) NOT NULL DEFAULT 0,
    fabric_waste_kg          NUMERIC(12, 3) NOT NULL DEFAULT 0,
    fabric_bitwaste_kg       NUMERIC(12, 3) NOT NULL DEFAULT 0,
    created_at               TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by               VARCHAR(100) NOT NULL,
    updated_at               TIMESTAMPTZ(6) NOT NULL,
    updated_by               VARCHAR(100)
);

-- Fabric Stock — one row per (date, color, size): starting Kora balance + fabric stock.
CREATE TABLE IF NOT EXISTS opening_balance_fabric_stock (
    id               UUID NOT NULL PRIMARY KEY,
    company_id       UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    date             DATE NOT NULL,
    color_id         UUID REFERENCES colors (id) ON UPDATE CASCADE ON DELETE SET NULL,
    size_id          UUID REFERENCES sizes (id) ON UPDATE CASCADE ON DELETE SET NULL,
    kora_balance_kg  NUMERIC(12, 3) NOT NULL DEFAULT 0,
    fabric_stock_kg  NUMERIC(12, 3) NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by       VARCHAR(100) NOT NULL,
    updated_at       TIMESTAMPTZ(6) NOT NULL,
    updated_by       VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS opening_balance_raw_materials_company_id_idx ON opening_balance_raw_materials (company_id);
CREATE INDEX IF NOT EXISTS opening_balance_raw_materials_group_id_idx ON opening_balance_raw_materials (group_id);
CREATE INDEX IF NOT EXISTS opening_balance_raw_materials_date_idx ON opening_balance_raw_materials (date);

CREATE INDEX IF NOT EXISTS opening_balance_wastage_company_id_idx ON opening_balance_wastage (company_id);
CREATE INDEX IF NOT EXISTS opening_balance_wastage_date_idx ON opening_balance_wastage (date);
CREATE INDEX IF NOT EXISTS opening_balance_wastage_color_id_idx ON opening_balance_wastage (color_id);
CREATE INDEX IF NOT EXISTS opening_balance_wastage_size_id_idx ON opening_balance_wastage (size_id);

CREATE INDEX IF NOT EXISTS opening_balance_fabric_stock_company_id_idx ON opening_balance_fabric_stock (company_id);
CREATE INDEX IF NOT EXISTS opening_balance_fabric_stock_date_idx ON opening_balance_fabric_stock (date);
CREATE INDEX IF NOT EXISTS opening_balance_fabric_stock_color_id_idx ON opening_balance_fabric_stock (color_id);
CREATE INDEX IF NOT EXISTS opening_balance_fabric_stock_size_id_idx ON opening_balance_fabric_stock (size_id);
