import type { Prisma } from '@prisma/client';
import { ProductionStage } from '@prisma/client';

const SYSTEM_SEED_ACTOR = 'system:seed';

const WASTAGE_TYPES = [
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

const BRANDS = ['Reliance', 'Haldia', 'Opel', 'Ghail'];
const CHEMICALS = ['DN+MB', 'ACM'];
const SIZES = ['150cm', '160cm', '170cm', '180cm', '190cm'];
const COLORS = ['White', 'Blue', 'Green'];


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
        date: new Date(),
        createdBy: actor,
      },
    });
  }
  for (const wastageType of WASTAGE_TYPES) {
  await tx.wastageType.upsert({
    where: {
      companyId_stage_code: {
        companyId,
        stage: wastageType.stage,
        code: wastageType.code,
      },
    },
    update: {
      name: wastageType.name,
      isColorTracked: wastageType.isColorTracked,
    },
    create: {
      companyId,
      stage: wastageType.stage,
      code: wastageType.code,
      name: wastageType.name,
      isColorTracked: wastageType.isColorTracked,
      createdBy: actor,
    },
  });
}
}
