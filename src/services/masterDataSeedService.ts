import type pg from 'pg';
import { ProductionStage } from '../types/enums.js';
import { DEFAULT_MODULES, DEFAULT_RIGHTS, DEFAULT_ROLES, type DefaultRightSpec } from '../constants/defaultAccessCatalog.js';
import { insertModule } from '../repositories/module.repository.js';
import { insertTabs } from '../repositories/tab.repository.js';
import { insertRight } from '../repositories/right.repository.js';
import { insertRoleAccess, insertRoleAccessRights } from '../repositories/roleAccess.repository.js';
import { deriveDisplayName, deriveRightName } from './rightService.js';

const SYSTEM_SEED_ACTOR = 'system:seed';

const WASTAGE_TYPES = [
  { stage: ProductionStage.EXTRUDER, code: 'YARN_WASTE', name: 'Yarn Waste', isColorTracked: false },
  { stage: ProductionStage.EXTRUDER, code: 'LUMPS', name: 'LUMS / LUMPS', isColorTracked: false },
  { stage: ProductionStage.LOOMS, code: 'LOOMS_WASTE', name: 'Looms Waste', isColorTracked: false },
  { stage: ProductionStage.FABRIC_CHECKING, code: 'FW', name: 'Fabric Wastage', isColorTracked: false },
  { stage: ProductionStage.FABRIC_CHECKING, code: 'BW', name: 'Bit Wastage', isColorTracked: true },
];

const BRANDS = ['Ghail','Opel','Haldia', 'Reliance' ];
const CHEMICALS = ['DN+MB', 'ACM'];
const SIZES = ['150cm', '160cm', '170cm', '180cm', '190cm'];
const COLORS = ['White', 'Blue', 'Green'];
const EXPENSE_NAMES = ['Electricity Charges', 'Water Charges', 'Machine Maintenance', 'Transportation', 'Office Supplies'];

async function seedLookupTable(
  client: pg.PoolClient,
  table: 'brands' | 'chemicals' | 'sizes' | 'colors' | 'expense_names',
  itemCodePrefix: string,
  seqColumn: string,
  names: string[],
  companyId: string,
  actor: string,
): Promise<void> {
  for (const [index, name] of names.entries()) {
    await client.query(
      `INSERT INTO ${table} (id, company_id, name, item_code, created_by, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, now())
       ON CONFLICT (company_id, name) DO NOTHING`,
      [companyId, name, `${itemCodePrefix}${String(index + 1).padStart(3, '0')}`, actor],
    );
  }
  // Idempotency guard for re-seeding an existing company: never lower a sequence that's already ahead.
  await client.query(`UPDATE companies SET ${seqColumn} = $2 WHERE id = $1 AND ${seqColumn} < $2`, [companyId, names.length + 1]);
}

/**
 * Seeds a new company's Layer-0 master data (brand/chemical/size/color + colour consumption
 * standard + wastage types) — PRD §12/§4/§5 defaults every new company starts with — plus the
 * default Module/Tab catalog. Must run inside the same transaction (same `client`) as the
 * caller's other signup/seed writes.
 */
export async function seedCompanyMasterData(client: pg.PoolClient, companyId: string, actor: string = SYSTEM_SEED_ACTOR): Promise<void> {
  await seedLookupTable(client, 'brands', 'BD', 'brand_seq', BRANDS, companyId, actor);
  await seedLookupTable(client, 'chemicals', 'CL', 'chemical_seq', CHEMICALS, companyId, actor);
  await seedLookupTable(client, 'sizes', 'SE', 'size_seq', SIZES, companyId, actor);
  await seedLookupTable(client, 'colors', 'CR', 'color_seq', COLORS, companyId, actor);
  await seedLookupTable(client, 'expense_names', 'EN', 'expense_name_seq', EXPENSE_NAMES, companyId, actor);

  // One record covers every colour, not one row per colour. PRD §5, confirmed:
  // White 150 g, Blue 100 g, Green 200 g per 25 KG — stored in kg, not grams;
  // chemical weight (1.2 kg) is common to all.
  const existingStandard = await client.query('SELECT 1 FROM color_consumption_standards WHERE company_id = $1 LIMIT 1', [companyId]);
  if (existingStandard.rowCount === 0) {
    await client.query(
      `INSERT INTO color_consumption_standards
         (id, company_id, basis_weight_kg, hdpe_material_bag, white_kg_basis, blue_kg_basis, green_kg_basis, chemical_weight_kg, date, created_by, updated_at)
       VALUES (gen_random_uuid(), $1, 25, 1, 0.15, 0.1, 0.2, 1.2, now(), $2, now())`,
      [companyId, actor],
    );
  }

  for (const wastageType of WASTAGE_TYPES) {
    await client.query(
      `INSERT INTO wastage_types (id, company_id, stage, code, name, is_color_tracked, created_by, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (company_id, stage, code) DO UPDATE SET name = EXCLUDED.name, is_color_tracked = EXCLUDED.is_color_tracked, updated_at = now()`,
      [companyId, wastageType.stage, wastageType.code, wastageType.name, wastageType.isColorTracked, actor],
    );
  }

  await seedDefaultModulesAndTabs(client, companyId);
}

/** Keys a DefaultRightSpec by (moduleCode, tabCode) so a seeded Right's id can be looked back up when assigning it to a Role. */
function rightSpecKey(spec: Pick<DefaultRightSpec, 'moduleCode' | 'tabCode' | 'action'>): string {
  return `${spec.moduleCode}|${spec.tabCode ?? ''}|${spec.action}`;
}

/**
 * Seeds a new company's default Module/Tab catalog (DEFAULT_MODULES), the default Rights
 * catalog (DEFAULT_RIGHTS), and the default Manager/Supervisor roles (DEFAULT_ROLES) — so a
 * fresh company has a usable role structure from day one. Admins can add/edit/delete beyond
 * this via the Module/Tab/Rights/Roles CRUD endpoints.
 */
async function seedDefaultModulesAndTabs(client: pg.PoolClient, companyId: string): Promise<void> {
  const moduleInfo = new Map<string, { id: string; name: string }>();
  // tabCode alone isn't globally unique (e.g. reused across future modules), so this is keyed
  // by moduleCode too, same as rightSpecKey.
  const tabInfo = new Map<string, { id: string; name: string }>();

  for (const mod of DEFAULT_MODULES) {
    const createdModule = await insertModule(client, { companyId, moduleCode: mod.code, moduleName: mod.name });
    moduleInfo.set(mod.code, { id: createdModule.id, name: mod.name });
    if (mod.tabs.length > 0) {
      const tabs = mod.tabs as unknown as { code: string; name: string }[];
      const createdTabs = await insertTabs(client, companyId, createdModule.id, tabs);
      const nameByCode = new Map(tabs.map((tab) => [tab.code, tab.name]));
      for (const createdTab of createdTabs) {
        tabInfo.set(`${mod.code}|${createdTab.tabCode}`, { id: createdTab.id, name: nameByCode.get(createdTab.tabCode) ?? createdTab.tabCode });
      }
    }
  }

  const rightIdBySpec = new Map<string, string>();
  for (const spec of DEFAULT_RIGHTS) {
    const module = moduleInfo.get(spec.moduleCode);
    if (!module) throw new Error(`DEFAULT_RIGHTS references unknown module code "${spec.moduleCode}"`);
    const tab = spec.tabCode ? tabInfo.get(`${spec.moduleCode}|${spec.tabCode}`) : undefined;
    if (spec.tabCode && !tab) throw new Error(`DEFAULT_RIGHTS references unknown tab code "${spec.tabCode}" on module "${spec.moduleCode}"`);

    const createdRight = await insertRight(client, {
      companyId,
      moduleId: module.id,
      tabId: tab?.id ?? null,
      action: spec.action,
      rightName: deriveRightName(spec.moduleCode, spec.tabCode ?? null, spec.action),
      displayName: deriveDisplayName(module.name, tab?.name ?? null, spec.action),
    });
    rightIdBySpec.set(rightSpecKey(spec), createdRight.id);
  }

  for (const role of DEFAULT_ROLES) {
    const createdRole = await insertRoleAccess(client, { companyId, roleName: role.name });
    const rightIds = role.rights.map((spec) => {
      const rightId = rightIdBySpec.get(rightSpecKey(spec));
      if (!rightId) throw new Error(`DEFAULT_ROLES role "${role.name}" references a right not present in DEFAULT_RIGHTS`);
      return rightId;
    });
    await insertRoleAccessRights(client, createdRole.id, rightIds);
  }
}
