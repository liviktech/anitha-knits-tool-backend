import { prisma } from '../config/prisma.js';
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

/** Creates a colour consumption standard — one record covers every colour (white/blue/green), not one row per colour. */
export async function createColorConsumptionStandard(
  input: CreateColorConsumptionStandardInput,
  companyId: string,
  actor: string,
) {
  return prisma.colorConsumptionStandard.create({
    data: {
      companyId,
      basisWeightKg: input.basisWeightKg,
      hdpematerialbag: input.hdpematerialbag,
      whiteGramsPerBasis: input.whiteGramsPerBasis,
      blueGramsPerBasis: input.blueGramsPerBasis,
      greenGramsPerBasis: input.greenGramsPerBasis,
      chemicalWeight: input.chemicalWeight,
      date: input.date,
      isActive: input.isActive,
      createdBy: actor,
    },
  });
}

const COLOR_GRAMS_FIELD = {
  white: 'whiteGramsPerBasis',
  blue: 'blueGramsPerBasis',
  green: 'greenGramsPerBasis',
} as const;

/**
 * Resolves the configured grams-per-basis for one named colour (PRD §5) out of
 * the latest active standard as of `asOf`. Colours outside the fixed
 * white/blue/green set (e.g. custom colours added later) have no standard —
 * callers must treat `null` as "not configured", not an error.
 */
export async function getGramsPerBasisForColor(companyId: string, colorName: string, asOf?: Date) {
  const field = COLOR_GRAMS_FIELD[colorName.trim().toLowerCase() as keyof typeof COLOR_GRAMS_FIELD];
  if (!field) return null;

  const standard = await getLatestColorConsumptionStandard(companyId, asOf?.toISOString());
  if (!standard || !standard.isActive) return null;

  return { gramsPerBasis: standard[field], basisWeightKg: standard.basisWeightKg };
}
