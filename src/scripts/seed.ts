/**
 * scripts/seed.ts — one-time platform superadmin bootstrap.
 *
 * Company-scoped master data (brands/chemicals/sizes/colors/wastage types, the default
 * colour consumption standard, and the default module/tab access-control catalog) is
 * always seeded automatically at signup by authService.signupCompany (via
 * masterDataSeedService.seedCompanyMasterData) — there is no standalone backfill path for
 * it anymore, since every company gets it unconditionally on creation.
 *
 * This script only creates the platform's one superadmin account — the same one-time
 * bootstrap platformAdminService.signupPlatformAdmin enforces (rejects once any
 * PlatformAdmin row exists), just runnable from the command line instead of over HTTP.
 *
 *   npm run seed:demo
 */
import { pool } from '../db/pool.js';
import { hashPassword } from '../utils/password.js';
import { countPlatformAdmins, createPlatformAdmin } from '../repositories/platformAdmin.repository.js';

const SUPERADMIN_NAME = 'Super Admin';
const SUPERADMIN_MOBILE = '9876543210';
const SUPERADMIN_PASSWORD = 'livik123';

async function main() {
  const existingCount = await countPlatformAdmins();
  if (existingCount > 0) {
    console.log('A platform admin already exists — skipping (this is a one-time bootstrap, same rule as POST /api/v1/platform/admin/signup).');
    return;
  }

  const passwordHash = await hashPassword(SUPERADMIN_PASSWORD);
  const admin = await createPlatformAdmin({ name: SUPERADMIN_NAME, mobile: SUPERADMIN_MOBILE, passwordHash });

  console.log(`Platform superadmin created: ${admin.mobile} (id ${admin.id}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
