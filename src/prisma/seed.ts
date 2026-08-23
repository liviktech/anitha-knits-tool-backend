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
  //    does: "Known brands include: Reliance, Haldia / TATA, Opel / Bangalore,
  //    Ghail / Madurai." Names kept verbatim from that PRD, including the
  //    "X / Y" pairings — confirm with the client if any is actually a typo
  //    (e.g. "Ghail" vs "GAIL").
  // -------------------------------------------------------------------------
  const brands = ['Reliance', 'Haldia / TATA', 'Opel / Bangalore', 'Ghail / Madurai']
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
  // 4. Colours + their consumption standard.
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
      where: { companyId_name: { companyId, name: c.name } },
      update: {},
      create: { companyId, name: c.name, createdBy: SYSTEM },
    })

    if (c.gramsPerBasis !== null) {
      await prisma.colorConsumptionStandard.upsert({
        where: { colorId: color.id },
        update: {},                   // do not silently reset a tuned value
        create: {
          companyId,
          colorId: color.id,
          gramsPerBasis: c.gramsPerBasis,
          basisWeightKg: 25,
          createdBy: SYSTEM,
        },
      })
    }
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
