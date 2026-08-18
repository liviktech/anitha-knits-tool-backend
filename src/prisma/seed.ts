import { prisma } from '../config/prisma.js';

async function main() {
  console.log('Seeding master data...');

  // --------------------------------------------------
  // Brands
  // --------------------------------------------------
  const brands = [
    'Reliance',
    'Haldia / TATA',
    'Opel / Bangalore',
    'Ghail / Madurai',
  ];

  for (const name of brands) {
    await prisma.brand.upsert({
      where: { name },
      update: {},
      create: {
        name,
      },
    });
  }

  // --------------------------------------------------
  // Colors
  // --------------------------------------------------
  const colors = ['White', 'Blue', 'Green', 'Custom'];

  for (const name of colors) {
    await prisma.color.upsert({
      where: { name },
      update: {},
      create: {
        name,
      },
    });
  }

  // --------------------------------------------------
  // Chemicals
  // --------------------------------------------------
  const chemicals = ['DM+', 'ACM'];

  for (const name of chemicals) {
    await prisma.chemical.upsert({
      where: { name },
      update: {},
      create: {
        name,
      },
    });
  }

  // --------------------------------------------------
  // Sizes
  // --------------------------------------------------
  const sizes = ['150mm', '160mm', '170mm', '180mm', '190mm'];

  for (const name of sizes) {
    await prisma.size.upsert({
      where: { name },
      update: {},
      create: {
        name,
      },
    });
  }

  console.log('Master data seeded successfully.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
