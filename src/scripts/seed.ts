/**
 * scripts/seed.ts — Layer 0 master data, seeded per-company.
 *
 * Master data is company-scoped, so seeding now happens per tenant after
 * signup, not once globally. Every write is an upsert keyed on the natural
 * per-company unique ([companyId, name] / [companyId, stage, code] /
 * companyId), so re-running never creates a second copy.
 *
 *   1. POST /api/v1/platform/admin/companies to create a company.
 *   2. SEED_COMPANY_ID=<company.id> npm run seed:demo
 *
 * Values marked TBD are placeholders — confirm with the client before
 * go-live (PRD §20).
 */

import { pool } from '../db/pool.js';
import { ProductionStage } from '../types/enums.js';
import { DEFAULT_MODULES } from '../constants/defaultAccessCatalog.js';
import { seedCompanyMasterData } from '../services/masterDataSeedService.js';

const SYSTEM = 'system:seed';

const companyId: string =
  process.env.SEED_COMPANY_ID ??
  (() => {
    throw new Error(
      'SEED_COMPANY_ID is required — sign up a company first, then run: SEED_COMPANY_ID=<company.id> npm run seed:demo',
    );
  })();

async function main() {
  const client = await pool.connect();
  try {
    // -------------------------------------------------------------------------
    // 1-4b. Brands / Chemicals / Sizes / Colours / Colour consumption standard —
    // shared with authService.signupCompany, which now seeds this same Layer 0
    // master data automatically for every brand-new company. This call remains
    // as a manual backfill path for a company that existed before that was added.
    // -------------------------------------------------------------------------
    await seedCompanyMasterData(client, companyId, SYSTEM);

    // -------------------------------------------------------------------------
    // 5. Wastage types — PRD §9. Codes are stable identifiers the app can
    //    branch on; names are what the operator sees and may be renamed.
    //    LUMS and LUMPS are the same thing, so there is one code, not two.
    // -------------------------------------------------------------------------
    const wastageTypes = [
      { stage: ProductionStage.EXTRUDER, code: 'YARN_WASTE', name: 'Yarn Waste', isColorTracked: false },
      { stage: ProductionStage.EXTRUDER, code: 'LUMPS', name: 'LUMS / LUMPS', isColorTracked: false },
      { stage: ProductionStage.LOOMS, code: 'LOOMS_WASTE', name: 'Looms Waste', isColorTracked: false },
      { stage: ProductionStage.FABRIC_CHECKING, code: 'FW', name: 'Fabric Wastage', isColorTracked: false },
      { stage: ProductionStage.FABRIC_CHECKING, code: 'BW', name: 'Bit Wastage', isColorTracked: true },
    ];

    for (const wt of wastageTypes) {
      await client.query(
        `INSERT INTO wastage_types (id, company_id, stage, code, name, is_color_tracked, created_by, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (company_id, stage, code) DO UPDATE SET name = EXCLUDED.name, is_color_tracked = EXCLUDED.is_color_tracked, updated_at = now()`,
        [companyId, wt.stage, wt.code, wt.name, wt.isColorTracked, SYSTEM],
      );
    }

    // -------------------------------------------------------------------------
    // 6. Access control catalog — Modules & Tabs (Admin Panel > Roles). New
    //    companies get this automatically at signup (authService.signupCompany);
    //    this backfills it for a company that existed before that was added.
    // -------------------------------------------------------------------------
    for (const mod of DEFAULT_MODULES) {
      const moduleResult = await client.query<{ id: string }>(
        `INSERT INTO modules (id, company_id, module_code, module_name, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, now())
         ON CONFLICT (company_id, module_code) DO UPDATE SET module_code = EXCLUDED.module_code
         RETURNING id`,
        [companyId, mod.code, mod.name],
      );
      const moduleId = moduleResult.rows[0]!.id;

      for (const tab of mod.tabs) {
        await client.query(
          `INSERT INTO tabs (id, company_id, module_id, tab_code, tab_name, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, now())
           ON CONFLICT (company_id, module_id, tab_code) DO UPDATE SET tab_code = EXCLUDED.tab_code`,
          [companyId, moduleId, tab.code, tab.name],
        );
      }
    }

    // No Rights are seeded — every Right (including the Production Details Add/Edit ones the
    // hard ceilings in productionCeilings.ts look for) is created manually by the admin via the
    // Roles tab (Module > Tab > Action), not auto-generated for any company, new or existing.

    console.log('Seed complete.');
  } finally {
    client.release();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
