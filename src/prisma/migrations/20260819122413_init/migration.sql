-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM ('EXTRUDER', 'LOOMS', 'FABRIC_CHECKING');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('AUTO_APPROVAL', 'MANAGER_APPROVAL');

-- CreateEnum
CREATE TYPE "ProductionRecordType" AS ENUM ('NORMAL', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "ApprovalEntityType" AS ENUM ('PRODUCTION_RECORD', 'WASTAGE_RECORD');

-- CreateTable
CREATE TABLE "production_settings" (
    "id" UUID NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "approval_mode" "ApprovalMode" NOT NULL DEFAULT 'MANAGER_APPROVAL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" VARCHAR(100),

    CONSTRAINT "production_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(100),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" VARCHAR(100),

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chemicals" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(100),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" VARCHAR(100),

    CONSTRAINT "chemicals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colors" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(100),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" VARCHAR(100),

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sizes" (
    "id" UUID NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(100),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" VARCHAR(100),

    CONSTRAINT "sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "color_consumption_standards" (
    "id" UUID NOT NULL,
    "color_id" UUID NOT NULL,
    "grams_per_basis" DECIMAL(10,3) NOT NULL,
    "basis_weight_kg" DECIMAL(10,3) NOT NULL DEFAULT 25,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(100),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" VARCHAR(100),

    CONSTRAINT "color_consumption_standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_records" (
    "id" UUID NOT NULL,
    "stage" "ProductionStage" NOT NULL,
    "production_date" DATE NOT NULL,
    "color_id" UUID NOT NULL,
    "size_id" UUID NOT NULL,
    "record_type" "ProductionRecordType" NOT NULL DEFAULT 'NORMAL',
    "reverses_record_id" UUID,
    "status" "ProductionStatus" NOT NULL DEFAULT 'DRAFT',
    "status_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(100) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" VARCHAR(100),

    CONSTRAINT "production_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extruder_details" (
    "id" UUID NOT NULL,
    "production_record_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "raw_material_kg" DECIMAL(12,3) NOT NULL,
    "chemical_id" UUID NOT NULL,
    "chemical_kg" DECIMAL(12,3) NOT NULL,
    "color_consumed_kg" DECIMAL(12,3) NOT NULL,
    "yarn_output_kg" DECIMAL(12,3) NOT NULL,
    "is_recipe_overridden" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" VARCHAR(500),

    CONSTRAINT "extruder_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loom_details" (
    "id" UUID NOT NULL,
    "production_record_id" UUID NOT NULL,
    "yarn_input_kg" DECIMAL(12,3) NOT NULL,
    "fabric_output_kg" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "loom_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fabric_check_details" (
    "id" UUID NOT NULL,
    "production_record_id" UUID NOT NULL,
    "fabric_input_kg" DECIMAL(12,3) NOT NULL,
    "piece_count" INTEGER NOT NULL,
    "first_grade_kg" DECIMAL(12,3) NOT NULL,
    "second_grade_kg" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "fabric_check_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wastage_types" (
    "id" UUID NOT NULL,
    "stage" "ProductionStage" NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_color_tracked" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(100),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" VARCHAR(100),

    CONSTRAINT "wastage_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wastage_records" (
    "id" UUID NOT NULL,
    "production_record_id" UUID NOT NULL,
    "wastage_type_id" UUID NOT NULL,
    "color_id" UUID,
    "quantity_kg" DECIMAL(12,3) NOT NULL,
    "reason" VARCHAR(500),
    "status" "ProductionStatus" NOT NULL DEFAULT 'DRAFT',
    "status_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(100) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" VARCHAR(100),

    CONSTRAINT "wastage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_events" (
    "id" UUID NOT NULL,
    "entity_type" "ApprovalEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "from_status" "ProductionStatus" NOT NULL,
    "to_status" "ProductionStatus" NOT NULL,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(100) NOT NULL,

    CONSTRAINT "approval_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_settings_singleton_key" ON "production_settings"("singleton");

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "chemicals_name_key" ON "chemicals"("name");

-- CreateIndex
CREATE UNIQUE INDEX "colors_name_key" ON "colors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sizes_name_key" ON "sizes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "color_consumption_standards_color_id_key" ON "color_consumption_standards"("color_id");

-- CreateIndex
CREATE INDEX "production_records_production_date_idx" ON "production_records"("production_date");

-- CreateIndex
CREATE INDEX "production_records_stage_production_date_idx" ON "production_records"("stage", "production_date");

-- CreateIndex
CREATE INDEX "production_records_color_id_size_id_idx" ON "production_records"("color_id", "size_id");

-- CreateIndex
CREATE INDEX "production_records_status_idx" ON "production_records"("status");

-- CreateIndex
CREATE INDEX "production_records_reverses_record_id_idx" ON "production_records"("reverses_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "extruder_details_production_record_id_key" ON "extruder_details"("production_record_id");

-- CreateIndex
CREATE INDEX "extruder_details_brand_id_idx" ON "extruder_details"("brand_id");

-- CreateIndex
CREATE INDEX "extruder_details_chemical_id_idx" ON "extruder_details"("chemical_id");

-- CreateIndex
CREATE UNIQUE INDEX "loom_details_production_record_id_key" ON "loom_details"("production_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "fabric_check_details_production_record_id_key" ON "fabric_check_details"("production_record_id");

-- CreateIndex
CREATE INDEX "wastage_types_stage_is_active_idx" ON "wastage_types"("stage", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "wastage_types_stage_code_key" ON "wastage_types"("stage", "code");

-- CreateIndex
CREATE INDEX "wastage_records_production_record_id_idx" ON "wastage_records"("production_record_id");

-- CreateIndex
CREATE INDEX "wastage_records_wastage_type_id_idx" ON "wastage_records"("wastage_type_id");

-- CreateIndex
CREATE INDEX "wastage_records_color_id_idx" ON "wastage_records"("color_id");

-- CreateIndex
CREATE INDEX "wastage_records_status_idx" ON "wastage_records"("status");

-- CreateIndex
CREATE INDEX "approval_events_entity_type_entity_id_created_at_idx" ON "approval_events"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "approval_events_to_status_created_at_idx" ON "approval_events"("to_status", "created_at");

-- AddForeignKey
ALTER TABLE "color_consumption_standards" ADD CONSTRAINT "color_consumption_standards_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_records" ADD CONSTRAINT "production_records_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_records" ADD CONSTRAINT "production_records_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_records" ADD CONSTRAINT "production_records_reverses_record_id_fkey" FOREIGN KEY ("reverses_record_id") REFERENCES "production_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extruder_details" ADD CONSTRAINT "extruder_details_production_record_id_fkey" FOREIGN KEY ("production_record_id") REFERENCES "production_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extruder_details" ADD CONSTRAINT "extruder_details_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extruder_details" ADD CONSTRAINT "extruder_details_chemical_id_fkey" FOREIGN KEY ("chemical_id") REFERENCES "chemicals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loom_details" ADD CONSTRAINT "loom_details_production_record_id_fkey" FOREIGN KEY ("production_record_id") REFERENCES "production_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_check_details" ADD CONSTRAINT "fabric_check_details_production_record_id_fkey" FOREIGN KEY ("production_record_id") REFERENCES "production_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_production_record_id_fkey" FOREIGN KEY ("production_record_id") REFERENCES "production_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_wastage_type_id_fkey" FOREIGN KEY ("wastage_type_id") REFERENCES "wastage_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
