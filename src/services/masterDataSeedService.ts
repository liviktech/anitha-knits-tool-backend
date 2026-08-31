import type { Prisma } from '@prisma/client';

const SYSTEM_SEED_ACTOR = 'system:seed';

// PRD §12 Raw Material Management: "Known brands include: Reliance, Haldia, Opel, Ghail."
const BRANDS = ['Reliance', 'Haldia', 'Opel', 'Ghail'];
// PRD §4: DN+MB or ACM, exactly one per extruder entry.
const CHEMICALS = ['DN+MB', 'ACM'];
// PRD §4.
const SIZES = ['150cm', '160cm', '170cm', '180cm', '190cm'];
// Custom colours are added later through the UI; a colour outside this fixed
// set simply has no consumption standard (the extruder form won't pre-fill for it).
const COLORS = ['White', 'Blue', 'Green'];

/**
 * Seeds Layer 0 master data (brands, chemicals, sizes, colors, colour
 * consumption standard) for one company — shared by prisma/seed.ts (manual
 * backfill for a pre-existing company) and authService.signupCompany
 * (automatic, inline for every brand-new company). Every write is an
 * upsert keyed on the natural per-company unique ([companyId, name] /
 * companyId), so it's safe to call more than once for the same company.
 * Time: O(1) — fixed, small master-data lists; Space: O(1).
 */
export async function seedCompanyMasterData(
  tx: Prisma.TransactionClient,
  companyId: string,
  actor: string = SYSTEM_SEED_ACTOR,
): Promise<void> {
  for (const [index, name] of BRANDS.entries()) {
    await tx.brand.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: {
        companyId,
        name,
        itemCode: `BD${String(index + 1).padStart(3, '0')}`,
        createdBy: actor,
      },
    });
  }
  await tx.company.updateMany({
    where: { id: companyId, brandSeq: { lt: BRANDS.length + 1 } },
    data: { brandSeq: BRANDS.length + 1 },
  });

  for (const [index, name] of CHEMICALS.entries()) {
    await tx.chemical.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: {
        companyId,
        name,
        itemCode: `CL${String(index + 1).padStart(3, '0')}`,
        createdBy: actor,
      },
    });
  }
  await tx.company.updateMany({
    where: { id: companyId, chemicalSeq: { lt: CHEMICALS.length + 1 } },
    data: { chemicalSeq: CHEMICALS.length + 1 },
  });

  for (const [index, name] of SIZES.entries()) {
    await tx.size.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: {
        companyId,
        name,
        itemCode: `SE${String(index + 1).padStart(3, '0')}`,
        createdBy: actor,
      },
    });
  }
  await tx.company.updateMany({
    where: { id: companyId, sizeSeq: { lt: SIZES.length + 1 } },
    data: { sizeSeq: SIZES.length + 1 },
  });

  for (const [index, name] of COLORS.entries()) {
    await tx.color.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: {
        companyId,
        name,
        itemCode: `CR${String(index + 1).padStart(3, '0')}`,
        createdBy: actor,
      },
    });
  }
  await tx.company.updateMany({
    where: { id: companyId, colorSeq: { lt: COLORS.length + 1 } },
    data: { colorSeq: COLORS.length + 1 },
  });

  // One record covers every colour, not one row per colour. PRD §5, confirmed:
  // White 150 g, Blue 100 g, Green 200 g per 25 KG — stored in kg, not grams;
  // chemical weight (1.2 kg) is common to all.
  const existingStandard = await tx.colorConsumptionStandard.findFirst({
    where: { companyId },
  });
  if (!existingStandard) {
    await tx.colorConsumptionStandard.create({
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
        createdBy: actor,
      },
    });
  }
}
