-- AlterTable: per-company sequence counters backing the new item codes (mirrors companies.employee_seq).
ALTER TABLE "companies" ADD COLUMN     "color_seq" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "size_seq" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "chemical_seq" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "brand_seq" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: add item_code nullable first — existing rows are backfilled below before it's made required.
ALTER TABLE "brands" ADD COLUMN     "item_code" VARCHAR(20);
ALTER TABLE "chemicals" ADD COLUMN     "item_code" VARCHAR(20);
ALTER TABLE "colors" ADD COLUMN     "item_code" VARCHAR(20);
ALTER TABLE "sizes" ADD COLUMN     "item_code" VARCHAR(20);

-- Backfill: number each company's existing rows by created_at ascending, so the earliest
-- record becomes 001 — the same rule new server-generated codes will follow going forward.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at ASC) AS rn
  FROM "brands"
)
UPDATE "brands" b
SET item_code = 'BD' || LPAD(numbered.rn::text, 3, '0')
FROM numbered
WHERE b.id = numbered.id;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at ASC) AS rn
  FROM "chemicals"
)
UPDATE "chemicals" c
SET item_code = 'CL' || LPAD(numbered.rn::text, 3, '0')
FROM numbered
WHERE c.id = numbered.id;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at ASC) AS rn
  FROM "colors"
)
UPDATE "colors" c
SET item_code = 'CR' || LPAD(numbered.rn::text, 3, '0')
FROM numbered
WHERE c.id = numbered.id;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at ASC) AS rn
  FROM "sizes"
)
UPDATE "sizes" s
SET item_code = 'SE' || LPAD(numbered.rn::text, 3, '0')
FROM numbered
WHERE s.id = numbered.id;

-- Advance each company's sequence counter past whatever was just backfilled, so the next
-- server-generated code continues from there instead of colliding with a backfilled one.
UPDATE "companies" co
SET brand_seq = COALESCE((SELECT COUNT(*) + 1 FROM "brands" b WHERE b.company_id = co.id), 1);

UPDATE "companies" co
SET chemical_seq = COALESCE((SELECT COUNT(*) + 1 FROM "chemicals" c WHERE c.company_id = co.id), 1);

UPDATE "companies" co
SET color_seq = COALESCE((SELECT COUNT(*) + 1 FROM "colors" c WHERE c.company_id = co.id), 1);

UPDATE "companies" co
SET size_seq = COALESCE((SELECT COUNT(*) + 1 FROM "sizes" s WHERE s.company_id = co.id), 1);

-- Now that every existing row has a value, enforce NOT NULL and per-company uniqueness.
ALTER TABLE "brands" ALTER COLUMN "item_code" SET NOT NULL;
ALTER TABLE "chemicals" ALTER COLUMN "item_code" SET NOT NULL;
ALTER TABLE "colors" ALTER COLUMN "item_code" SET NOT NULL;
ALTER TABLE "sizes" ALTER COLUMN "item_code" SET NOT NULL;

CREATE UNIQUE INDEX "brands_company_id_item_code_key" ON "brands"("company_id", "item_code");
CREATE UNIQUE INDEX "chemicals_company_id_item_code_key" ON "chemicals"("company_id", "item_code");
CREATE UNIQUE INDEX "colors_company_id_item_code_key" ON "colors"("company_id", "item_code");
CREATE UNIQUE INDEX "sizes_company_id_item_code_key" ON "sizes"("company_id", "item_code");
