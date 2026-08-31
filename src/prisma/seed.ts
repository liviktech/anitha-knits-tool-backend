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
import { seedCompanyMasterData } from '../services/masterDataSeedService.js';

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
  // 1-4b. Brands / Chemicals / Sizes / Colours / Colour consumption standard —
  // shared with authService.signupCompany, which now seeds this same Layer 0
  // master data automatically for every brand-new company. This call remains
  // as a manual backfill path for a company that existed before that was added.
  // -------------------------------------------------------------------------
  await seedCompanyMasterData(prisma, companyId, SYSTEM);

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
