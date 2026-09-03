-- ============================================================
-- Migration: Production (Extruder / Looms / Fabric Checking) and wastage
-- One production_records row per stage entry, with a stage-specific 1:1
-- detail table (extruder_details / loom_details / fabric_check_details).
-- wastage_records/wastage_types are entered alongside a production record.
-- ============================================================

CREATE TABLE IF NOT EXISTS production_records (
    id                  UUID NOT NULL PRIMARY KEY,
    company_id          UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    type                "ProductionType" NOT NULL DEFAULT 'PRODUCTION',
    stage               "ProductionStage" NOT NULL,
    production_date     DATE NOT NULL,
    color_id            UUID NOT NULL REFERENCES colors (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    size_id             UUID NOT NULL REFERENCES sizes (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    record_type         "ProductionRecordType" NOT NULL DEFAULT 'NORMAL',
    -- Self-reference: an ADJUSTMENT/REVERSAL record points back at the record it corrects.
    reverses_record_id  UUID REFERENCES production_records (id) ON UPDATE CASCADE ON DELETE SET NULL,
    remarks             VARCHAR(500),
    is_approved         BOOLEAN NOT NULL DEFAULT false,
    approved_at         TIMESTAMPTZ(6),
    approved_by         VARCHAR(100),
    created_at          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          VARCHAR(100) NOT NULL,
    updated_at          TIMESTAMPTZ(6) NOT NULL,
    updated_by          VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS extruder_details (
    id                    UUID NOT NULL PRIMARY KEY,
    production_record_id  UUID NOT NULL UNIQUE REFERENCES production_records (id) ON UPDATE CASCADE ON DELETE CASCADE,
    brand_id              UUID NOT NULL REFERENCES brands (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    raw_material_kg       NUMERIC(12, 3) NOT NULL,
    chemical_id           UUID NOT NULL REFERENCES chemicals (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    chemical_kg           NUMERIC(12, 3) NOT NULL,
    color_consumed_kg     NUMERIC(12, 3) NOT NULL,
    yarn_output_kg        NUMERIC(12, 3) NOT NULL,
    is_recipe_overridden  BOOLEAN NOT NULL DEFAULT false,
    override_reason       VARCHAR(500),
    bag_count             INTEGER,
    bag_weight_kg         NUMERIC(12, 3),
    loose_weight_kg       NUMERIC(12, 3),
    total_weight_kg       NUMERIC(12, 3)
);

CREATE TABLE IF NOT EXISTS loom_details (
    id                    UUID NOT NULL PRIMARY KEY,
    production_record_id  UUID NOT NULL UNIQUE REFERENCES production_records (id) ON UPDATE CASCADE ON DELETE CASCADE,
    yarn_input_kg         NUMERIC(12, 3) NOT NULL,
    fabric_output_kg      NUMERIC(12, 3) NOT NULL
);

CREATE TABLE IF NOT EXISTS fabric_check_details (
    id                    UUID NOT NULL PRIMARY KEY,
    production_record_id  UUID NOT NULL UNIQUE REFERENCES production_records (id) ON UPDATE CASCADE ON DELETE CASCADE,
    fabric_input_kg       NUMERIC(12, 3) NOT NULL,
    output_kg             NUMERIC(12, 3)
);

CREATE TABLE IF NOT EXISTS wastage_types (
    id               UUID NOT NULL PRIMARY KEY,
    company_id       UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    stage            "ProductionStage" NOT NULL,
    -- Stable branch-on identifier (YARN_WASTE/LUMPS/LOOMS_WASTE/FW/BW) — name is the
    -- operator-facing label and may be renamed; code must not be.
    code             VARCHAR(50) NOT NULL,
    name             VARCHAR(100) NOT NULL,
    is_color_tracked BOOLEAN NOT NULL DEFAULT false,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by       VARCHAR(100),
    updated_at       TIMESTAMPTZ(6) NOT NULL,
    updated_by       VARCHAR(100),
    UNIQUE (company_id, stage, code)
);

-- No onDelete cascade to production_records — must be deleted explicitly before the
-- parent record (see extruder/looms/fabricChecking *Service.ts delete flows).
CREATE TABLE IF NOT EXISTS wastage_records (
    id                    UUID NOT NULL PRIMARY KEY,
    company_id            UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    production_record_id  UUID NOT NULL REFERENCES production_records (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    wastage_type_id       UUID NOT NULL REFERENCES wastage_types (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    -- Only meaningful for colour-tracked types (BW). NULL for FW/YARN_WASTE/LUMPS/LOOMS_WASTE.
    color_id              UUID REFERENCES colors (id) ON UPDATE CASCADE ON DELETE SET NULL,
    quantity_kg           NUMERIC(12, 3) NOT NULL,
    reason                VARCHAR(500),
    created_at            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by            VARCHAR(100) NOT NULL,
    updated_at            TIMESTAMPTZ(6) NOT NULL,
    updated_by            VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS production_records_company_id_idx ON production_records (company_id);
CREATE INDEX IF NOT EXISTS production_records_company_id_production_date_idx ON production_records (company_id, production_date);
CREATE INDEX IF NOT EXISTS production_records_company_id_stage_production_date_idx ON production_records (company_id, stage, production_date);
CREATE INDEX IF NOT EXISTS production_records_company_id_is_approved_idx ON production_records (company_id, is_approved);
CREATE INDEX IF NOT EXISTS production_records_color_id_size_id_idx ON production_records (color_id, size_id);
CREATE INDEX IF NOT EXISTS production_records_reverses_record_id_idx ON production_records (reverses_record_id);
CREATE INDEX IF NOT EXISTS extruder_details_brand_id_idx ON extruder_details (brand_id);
CREATE INDEX IF NOT EXISTS extruder_details_chemical_id_idx ON extruder_details (chemical_id);
CREATE INDEX IF NOT EXISTS wastage_types_company_id_stage_is_active_idx ON wastage_types (company_id, stage, is_active);
CREATE INDEX IF NOT EXISTS wastage_records_company_id_idx ON wastage_records (company_id);
CREATE INDEX IF NOT EXISTS wastage_records_production_record_id_idx ON wastage_records (production_record_id);
CREATE INDEX IF NOT EXISTS wastage_records_wastage_type_id_idx ON wastage_records (wastage_type_id);
CREATE INDEX IF NOT EXISTS wastage_records_color_id_idx ON wastage_records (color_id);
