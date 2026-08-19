/**
 * prisma/seed.ts — Layer 0 master data.
 *
 * Run once before any production entry exists, and safe to re-run: every
 * write is an upsert keyed on the natural unique (name / [stage, code]),
 * so re-running never creates a second copy.
 *
 *   npx prisma db seed
 *
 * Values marked TBD are placeholders — confirm with the client before
 * go-live (PRD §20).
 */

import { ProductionStage, ApprovalMode } from '@prisma/client'
import { prisma } from '../config/prisma.js'

const SYSTEM = 'system:seed'

async function main() {
  // -------------------------------------------------------------------------
  // 1. Settings — exactly one row, ever.
  //    The `singleton` unique makes the upsert key stable.
  // -------------------------------------------------------------------------
  await prisma.productionSetting.upsert({
    where: { singleton: true },
    update: {},                       // never overwrite a live setting
    create: {
      singleton: true,
      approvalMode: ApprovalMode.MANAGER_APPROVAL,
      updatedBy: SYSTEM,
    },
  })

  // -------------------------------------------------------------------------
  // 2. Brands — the HDPE suppliers the factory buys from.
  //    The Production Module PRD (§4) only confirms the raw material is HDPE
  //    and doesn't list brands. The baseline PRD (§12 Raw Material Management)
  //    does: "Known brands include: Reliance, Haldia / TATA, Opel / Bangalore,
  //    Ghail / Madurai." Names kept verbatim from that PRD, including the
  //    "X / Y" pairings — confirm with the client if any is actually a typo
  //    (e.g. "Ghail" vs "GAIL").
  // -------------------------------------------------------------------------
  const brands = ['Reliance', 'Haldia / TATA', 'Opel / Bangalore', 'Ghail / Madurai']
  for (const name of brands) {
    await prisma.brand.upsert({
      where: { name },
      update: {},
      create: { name, createdBy: SYSTEM },
    })
  }

  // -------------------------------------------------------------------------
  // 3. Chemicals — PRD §4: DN+MB or ACM, exactly one per extruder entry.
  // -------------------------------------------------------------------------
  for (const name of ['DN+MB', 'ACM']) {
    await prisma.chemical.upsert({
      where: { name },
      update: {},
      create: { name, createdBy: SYSTEM },
    })
  }

  // -------------------------------------------------------------------------
  // 4. Sizes — PRD §4.
  // -------------------------------------------------------------------------
  for (const name of ['150mm', '160mm', '170mm', '180mm', '190mm']) {
    await prisma.size.upsert({
      where: { name },
      update: {},
      create: { name, createdBy: SYSTEM },
    })
  }

  // -------------------------------------------------------------------------
  // 5. Colours + their consumption standard.
  //    PRD §5, confirmed: White 150 g, Blue 100 g, Green 200 g per 25 KG.
  //    Custom colours are added later through the UI; a colour with no
  //    standard simply means the extruder form does not pre-fill.
  // -------------------------------------------------------------------------
  const colors: Array<{ name: string; gramsPerBasis: number | null }> = [
    { name: 'White', gramsPerBasis: 150 },
    { name: 'Blue', gramsPerBasis: 100 },
    { name: 'Green', gramsPerBasis: 200 },
  ]

  for (const c of colors) {
    const color = await prisma.color.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name, createdBy: SYSTEM },
    })

    if (c.gramsPerBasis !== null) {
      await prisma.colorConsumptionStandard.upsert({
        where: { colorId: color.id },
        update: {},                   // do not silently reset a tuned value
        create: {
          colorId: color.id,
          gramsPerBasis: c.gramsPerBasis,
          basisWeightKg: 25,
          createdBy: SYSTEM,
        },
      })
    }
  }

  // -------------------------------------------------------------------------
  // 6. Wastage types — PRD §9. Codes are stable identifiers the app can
  //    branch on; names are what the operator sees and may be renamed.
  //    LUMS and LUMPS are the same thing, so there is one code, not two.
  // -------------------------------------------------------------------------
  const wastageTypes = [
    { stage: ProductionStage.EXTRUDER,        code: 'YARN_WASTE',  name: 'Yarn Waste',     isColorTracked: false },
    { stage: ProductionStage.EXTRUDER,        code: 'LUMPS',       name: 'LUMS / LUMPS',   isColorTracked: false },
    { stage: ProductionStage.LOOMS,           code: 'LOOMS_WASTE', name: 'Looms Waste',    isColorTracked: false },
    { stage: ProductionStage.FABRIC_CHECKING, code: 'FW',          name: 'Fabric Wastage', isColorTracked: false },
    { stage: ProductionStage.FABRIC_CHECKING, code: 'BW',          name: 'Bit Wastage',    isColorTracked: true  },
  ]

  for (const wt of wastageTypes) {
    await prisma.wastageType.upsert({
      where: { stage_code: { stage: wt.stage, code: wt.code } },
      update: { name: wt.name, isColorTracked: wt.isColorTracked },
      create: { ...wt, createdBy: SYSTEM },
    })
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
