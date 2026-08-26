import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { assertColorExists } from './masterDataService.js';
import { ConflictError } from '../utils/errors.js';
import type { CreateColorConsumptionStandardInput } from '../validations/adminConfigValidation.js';

export async function getLatestColorConsumptionStandard(
  companyId: string,
  dateStr?: string,
) {
  const asOf = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(asOf.getTime())) {
    throw new Error('Invalid date');
  }
  const dateOnly = new Date(
    Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()),
  );

  const record = await prisma.colorConsumptionStandard.findFirst({
    where: {
      companyId,
      date: {
        lte: dateOnly,
      },
    },
    orderBy: { date: 'desc' },
  });

  return record ?? null;
}

/** Creates a colour consumption standard. Fails with 409 if one already exists for the colour (colorId is unique). */
export async function createColorConsumptionStandard(
  input: CreateColorConsumptionStandardInput,
  companyId: string,
  actor: string,
) {
  await assertColorExists(input.colorId, companyId);

  try {
    return await prisma.colorConsumptionStandard.create({
      data: {
        companyId,
        colorId: input.colorId,
        gramsPerBasis: input.gramsPerBasis,
        basisWeightKg: input.basisWeightKg,
        hdpematerialbag: input.hdpematerialbag,
        chemicalWeight: input.chemicalWeight,
        date: input.date,
        isActive: input.isActive,
        createdBy: actor,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError(
        'A consumption standard already exists for this colour',
        'COLOR_CONSUMPTION_STANDARD_EXISTS',
        { colorId: input.colorId },
      );
    }
    throw err;
  }
}
