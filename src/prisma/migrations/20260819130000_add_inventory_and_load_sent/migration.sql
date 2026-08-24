-- CreateEnum
CREATE TYPE "InventoryType" AS ENUM ('HDPE', 'CHEMICAL', 'COLOR');

-- CreateTable
CREATE TABLE "inventory" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "InventoryType" NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "weight_kg" DECIMAL(12,3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(100) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" VARCHAR(100),

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "load_sent" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "color_id" UUID NOT NULL,
    "size_id" UUID NOT NULL,
    "piece_count" INTEGER NOT NULL,
    "weight_kg" DECIMAL(12,3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(100) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" VARCHAR(100),

    CONSTRAINT "load_sent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_date_idx" ON "inventory"("date");

-- CreateIndex
CREATE INDEX "inventory_type_idx" ON "inventory"("type");

-- CreateIndex
CREATE INDEX "inventory_name_idx" ON "inventory"("name");

-- CreateIndex
CREATE INDEX "load_sent_date_idx" ON "load_sent"("date");

-- CreateIndex
CREATE INDEX "load_sent_color_id_idx" ON "load_sent"("color_id");

-- CreateIndex
CREATE INDEX "load_sent_size_id_idx" ON "load_sent"("size_id");

-- AddForeignKey
ALTER TABLE "load_sent" ADD CONSTRAINT "load_sent_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_sent" ADD CONSTRAINT "load_sent_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
