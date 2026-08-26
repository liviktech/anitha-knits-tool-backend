/**
 * prisma/seed.ts — Layer 0 master data, seeded per-company.
 *
 * Master data is company-scoped, so seeding now happens per tenant after
 * signup, not once globally. Every write is an upsert keyed on the natural
 * per-company unique ([companyId, name] / [companyId, stage, code] /
 * companyId), so re-running never creates a second copy.
 *
 *   1. POST /api/v1/company/auth/signup to create a company.
 *   2. SEED_COMPANY_ID=<company.id> npx prisma db seed
 *
 * Values marked TBD are placeholders — confirm with the client before
 * go-live (PRD §20).
 */

import { ProductionStage } from '@prisma/client'
import { prisma } from '../config/prisma.js'

const SYSTEM = 'system:seed'

// A ternary (not an `if` guard) so TypeScript keeps this narrowed to `string`
// inside the closures below — control-flow narrowing on a bare `const` doesn't
// survive being captured by a function declared later in the same module.
const companyId: string = process.env.SEED_COMPANY_ID ?? (() => {
  throw new Error(
    'SEED_COMPANY_ID is required — sign up a company first, then run: SEED_COMPANY_ID=<company.id> npx prisma db seed',
  )
})()

async function main() {
  // -------------------------------------------------------------------------
  // 1. Brands — the HDPE suppliers the factory buys from.
  //    The Production Module PRD (§4) only confirms the raw material is HDPE
  //    and doesn't list brands. The baseline PRD (§12 Raw Material Management)
  //    does: "Known brands include: Reliance, Haldia, Opel, Ghail." 
  // -------------------------------------------------------------------------
  const brands = ['Reliance', 'Haldia', 'Opel', 'Ghail']
  for (const name of brands) {
    await prisma.brand.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: { companyId, name, createdBy: SYSTEM },
    })
  }

  // -------------------------------------------------------------------------
  // 2. Chemicals — PRD §4: DN+MB or ACM, exactly one per extruder entry.
  // -------------------------------------------------------------------------
  for (const name of ['DN+MB', 'ACM']) {
    await prisma.chemical.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: { companyId, name, createdBy: SYSTEM },
    })
  }

  // -------------------------------------------------------------------------
  // 3. Sizes — PRD §4.
  // -------------------------------------------------------------------------
  for (const name of ['150mm', '160mm', '170mm', '180mm', '190mm']) {
    await prisma.size.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: { companyId, name, createdBy: SYSTEM },
    })
  }

  // -------------------------------------------------------------------------
  // 4. Colours. Custom colours are added later through the UI; a colour
  //    outside the fixed white/blue/green set simply has no consumption
  //    standard (the extruder form does not pre-fill for it).
  // -------------------------------------------------------------------------
  for (const name of ['White', 'Blue', 'Green']) {
    await prisma.color.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: { companyId, name, createdBy: SYSTEM },
    })
  }

  // -------------------------------------------------------------------------
  // 4b. Colour consumption standard — one record covers every colour, not
  //     one row per colour. PRD §5, confirmed: White 150 g, Blue 100 g,
  //     Green 200 g per 25 KG; chemical weight (1.2 kg) is common to all.
  // -------------------------------------------------------------------------
  const existingStandard = await prisma.colorConsumptionStandard.findFirst({ where: { companyId } })
  if (!existingStandard) {
    await prisma.colorConsumptionStandard.create({
      data: {
        companyId,
        basisWeightKg: 25,
        hdpematerialbag: 1,
        whiteGramsPerBasis: 150,
        blueGramsPerBasis: 100,
        greenGramsPerBasis: 200,
        chemicalWeight: 1.2,
        // "latest as of" lookups filter on date <= asOf, so a null date
        // would never match — stamp it effective immediately.
        date: new Date(),
        createdBy: SYSTEM,
      },
    })
  }

  // -------------------------------------------------------------------------
  // 5. Wastage types — PRD §9. Codes are stable identifiers the app can
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
      where: { companyId_stage_code: { companyId, stage: wt.stage, code: wt.code } },
      update: { name: wt.name, isColorTracked: wt.isColorTracked },
      create: { ...wt, companyId, createdBy: SYSTEM },
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
