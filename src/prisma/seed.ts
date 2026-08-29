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

import { ProductionStage } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { DEFAULT_MODULES } from '../constants/defaultAccessCatalog.js';

const SYSTEM = 'system:seed';

// A ternary (not an `if` guard) so TypeScript keeps this narrowed to `string`
// inside the closures below — control-flow narrowing on a bare `const` doesn't
// survive being captured by a function declared later in the same module.
const companyId: string =
  process.env.SEED_COMPANY_ID ??
  (() => {
    throw new Error(
      'SEED_COMPANY_ID is required — sign up a company first, then run: SEED_COMPANY_ID=<company.id> npx prisma db seed',
    );
  })();

async function main() {
  // -------------------------------------------------------------------------
  // 1. Brands — the HDPE suppliers the factory buys from.
  //    The Production Module PRD (§4) only confirms the raw material is HDPE
  //    and doesn't list brands. The baseline PRD (§12 Raw Material Management)
  //    does: "Known brands include: Reliance, Haldia, Opel, Ghail."
  // -------------------------------------------------------------------------
  const brands = ['Reliance', 'Haldia', 'Opel', 'Ghail'];
  for (const [index, name] of brands.entries()) {
    await prisma.brand.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: {
        companyId,
        name,
        itemCode: `BD${String(index + 1).padStart(3, '0')}`,
        createdBy: SYSTEM,
      },
    });
  }
  // Advance the per-company sequence counter past whatever was just seeded (never below it — the
  // guard makes this safe to rerun), so the next server-generated code doesn't collide with a seeded one.
  await prisma.company.updateMany({
    where: { id: companyId, brandSeq: { lt: brands.length + 1 } },
    data: { brandSeq: brands.length + 1 },
  });

  // -------------------------------------------------------------------------
  // 2. Chemicals — PRD §4: DN+MB or ACM, exactly one per extruder entry.
  // -------------------------------------------------------------------------
  const chemicals = ['DN+MB', 'ACM'];
  for (const [index, name] of chemicals.entries()) {
    await prisma.chemical.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: {
        companyId,
        name,
        itemCode: `CL${String(index + 1).padStart(3, '0')}`,
        createdBy: SYSTEM,
      },
    });
  }
  await prisma.company.updateMany({
    where: { id: companyId, chemicalSeq: { lt: chemicals.length + 1 } },
    data: { chemicalSeq: chemicals.length + 1 },
  });

  // -------------------------------------------------------------------------
  // 3. Sizes — PRD §4.
  // -------------------------------------------------------------------------
  const sizes = ['150cm', '160cm', '170cm', '180cm', '190cm'];
  for (const [index, name] of sizes.entries()) {
    await prisma.size.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: {
        companyId,
        name,
        itemCode: `SE${String(index + 1).padStart(3, '0')}`,
        createdBy: SYSTEM,
      },
    });
  }
  await prisma.company.updateMany({
    where: { id: companyId, sizeSeq: { lt: sizes.length + 1 } },
    data: { sizeSeq: sizes.length + 1 },
  });

  // -------------------------------------------------------------------------
  // 4. Colours. Custom colours are added later through the UI; a colour
  //    outside the fixed white/blue/green set simply has no consumption
  //    standard (the extruder form does not pre-fill for it).
  // -------------------------------------------------------------------------
  const colors = ['White', 'Blue', 'Green'];
  for (const [index, name] of colors.entries()) {
    await prisma.color.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: {
        companyId,
        name,
        itemCode: `CR${String(index + 1).padStart(3, '0')}`,
        createdBy: SYSTEM,
      },
    });
  }
  await prisma.company.updateMany({
    where: { id: companyId, colorSeq: { lt: colors.length + 1 } },
    data: { colorSeq: colors.length + 1 },
  });

  // -------------------------------------------------------------------------
  // 4b. Colour consumption standard — one record covers every colour, not
  //     one row per colour. PRD §5, confirmed: White 150 g, Blue 100 g,
  //     Green 200 g per 25 KG — stored in kg (0.150/0.100/0.200), not grams;
  //     chemical weight (1.2 kg) is common to all.
  // -------------------------------------------------------------------------
  const existingStandard = await prisma.colorConsumptionStandard.findFirst({
    where: { companyId },
  });
  if (!existingStandard) {
    await prisma.colorConsumptionStandard.create({
      data: {
        companyId,
        basisWeightKg: 25,
        hdpematerialbag: 1,
        whiteKgBasis: 0.15,
        blueKgBasis: 0.1,
        greenKgBasis: 0.2,
        chemicalWeight: 1.2,
        // "latest as of" lookups filter on date <= asOf, so a null date
        // would never match — stamp it effective immediately.
        date: new Date(),
        createdBy: SYSTEM,
      },
    });
  }

  // -------------------------------------------------------------------------
  // 5. Wastage types — PRD §9. Codes are stable identifiers the app can
  //    branch on; names are what the operator sees and may be renamed.
  //    LUMS and LUMPS are the same thing, so there is one code, not two.
  // -------------------------------------------------------------------------
  const wastageTypes = [
    {
      stage: ProductionStage.EXTRUDER,
      code: 'YARN_WASTE',
      name: 'Yarn Waste',
      isColorTracked: false,
    },
    {
      stage: ProductionStage.EXTRUDER,
      code: 'LUMPS',
      name: 'LUMS / LUMPS',
      isColorTracked: false,
    },
    {
      stage: ProductionStage.LOOMS,
      code: 'LOOMS_WASTE',
      name: 'Looms Waste',
      isColorTracked: false,
    },
    {
      stage: ProductionStage.FABRIC_CHECKING,
      code: 'FW',
      name: 'Fabric Wastage',
      isColorTracked: false,
    },
    {
      stage: ProductionStage.FABRIC_CHECKING,
      code: 'BW',
      name: 'Bit Wastage',
      isColorTracked: true,
    },
  ];

  for (const wt of wastageTypes) {
    await prisma.wastageType.upsert({
      where: {
        companyId_stage_code: { companyId, stage: wt.stage, code: wt.code },
      },
      update: { name: wt.name, isColorTracked: wt.isColorTracked },
      create: { ...wt, companyId, createdBy: SYSTEM },
    });
  }

  // -------------------------------------------------------------------------
  // 6. Access control catalog — Modules & Tabs (Admin Panel > Roles). New
  //    companies get this automatically at signup (authService.signupCompany);
  //    this backfills it for a company that existed before that was added.
  // -------------------------------------------------------------------------
  for (const mod of DEFAULT_MODULES) {
    const moduleRecord = await prisma.module.upsert({
      where: { companyId_moduleCode: { companyId, moduleCode: mod.code } },
      update: {},
      create: { companyId, moduleCode: mod.code, moduleName: mod.name },
    });

    for (const tab of mod.tabs) {
      await prisma.tab.upsert({
        where: {
          companyId_moduleId_tabCode: {
            companyId,
            moduleId: moduleRecord.id,
            tabCode: tab.code,
          },
        },
        update: {},
        create: {
          companyId,
          moduleId: moduleRecord.id,
          tabCode: tab.code,
          tabName: tab.name,
        },
      });
    }
  }

  // No Rights are seeded — every Right (including the Production Details Add/Edit ones the
  // hard ceilings in productionCeilings.ts look for) is created manually by the admin via the
  // Roles tab (Module > Tab > Action), not auto-generated for any company, new or existing.

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
