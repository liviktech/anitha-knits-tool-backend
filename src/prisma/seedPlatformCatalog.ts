/**
 * Seeds LK Space's own PlatformModule catalog (Dashboard/Companies/Users/Roles and Rights).
 * Idempotent (upsert on moduleCode) — safe to re-run. There's no per-company "signup" moment to
 * hook this into (LK Space itself isn't a tenant), so it's a one-off script instead:
 *
 *   npx tsx src/prisma/seedPlatformCatalog.ts
 */
import { prisma } from '../config/prisma.js';
import { DEFAULT_PLATFORM_MODULES } from '../constants/defaultPlatformAccessCatalog.js';

async function main() {
  for (const module of DEFAULT_PLATFORM_MODULES) {
    await prisma.platformModule.upsert({
      where: { moduleCode: module.code },
      create: { moduleCode: module.code, moduleName: module.name },
      update: { moduleName: module.name },
    });
  }
  console.log(`Seeded ${DEFAULT_PLATFORM_MODULES.length} platform module(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
