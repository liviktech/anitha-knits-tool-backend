-- ============================================================
-- Migration: Master data (brands, chemicals, colors, sizes) and the
-- colour consumption standard
-- All company-scoped lookup tables consumed by the production stages.
-- item_code is always server-generated (prefix + the matching companies.*_seq
-- counter), never client-supplied.
-- ============================================================

CREATE TABLE IF NOT EXISTS brands (
    id         UUID NOT NULL PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    item_code  VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_at TIMESTAMPTZ(6) NOT NULL,
    updated_by VARCHAR(100),
    UNIQUE (company_id, name),
    UNIQUE (company_id, item_code)
);

CREATE TABLE IF NOT EXISTS chemicals (
    id         UUID NOT NULL PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    item_code  VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_at TIMESTAMPTZ(6) NOT NULL,
    updated_by VARCHAR(100),
    UNIQUE (company_id, name),
    UNIQUE (company_id, item_code)
);

CREATE TABLE IF NOT EXISTS colors (
    id         UUID NOT NULL PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    name       VARCHAR(50) NOT NULL,
    item_code  VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_at TIMESTAMPTZ(6) NOT NULL,
    updated_by VARCHAR(100),
    UNIQUE (company_id, name),
    UNIQUE (company_id, item_code)
);

CREATE TABLE IF NOT EXISTS sizes (
    id         UUID NOT NULL PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    name       VARCHAR(30) NOT NULL,
    item_code  VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_at TIMESTAMPTZ(6) NOT NULL,
    updated_by VARCHAR(100),
    UNIQUE (company_id, name),
    UNIQUE (company_id, item_code)
);

-- One row covers every colour (white/blue/green), not one row per colour — see
-- adminConfig.ts / getKgPerBasisForColor.
CREATE TABLE IF NOT EXISTS color_consumption_standards (
    id                 UUID NOT NULL PRIMARY KEY,
    company_id         UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    basis_weight_kg    NUMERIC(10, 3) NOT NULL DEFAULT 25,
    hdpe_material_bag  INTEGER NOT NULL DEFAULT 1,
    white_kg_basis     NUMERIC(10, 3) NOT NULL,
    blue_kg_basis      NUMERIC(10, 3) NOT NULL,
    green_kg_basis     NUMERIC(10, 3) NOT NULL,
    chemical_weight_kg NUMERIC(12, 3),
    date               DATE,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by         VARCHAR(100),
    updated_at         TIMESTAMPTZ(6) NOT NULL,
    updated_by         VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS brands_company_id_idx ON brands (company_id);
CREATE INDEX IF NOT EXISTS chemicals_company_id_idx ON chemicals (company_id);
CREATE INDEX IF NOT EXISTS colors_company_id_idx ON colors (company_id);
CREATE INDEX IF NOT EXISTS sizes_company_id_idx ON sizes (company_id);
CREATE INDEX IF NOT EXISTS color_consumption_standards_company_id_idx ON color_consumption_standards (company_id);
