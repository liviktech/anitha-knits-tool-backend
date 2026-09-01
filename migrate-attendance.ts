import { prisma } from './src/config/prisma';

async function main() {
  const result = await prisma.$executeRaw`UPDATE "attendances" SET "status" = 'DAY_SHIFT' WHERE "status" = 'PRESENT'`;
  console.log(`Updated ${result} attendance records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
