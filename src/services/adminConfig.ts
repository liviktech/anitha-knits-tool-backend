import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import type {
  CreateColorConsumptionStandardInput,
  UpdateColorConsumptionStandardInput,
} from '../validations/adminConfigValidation.js';

/** Internal row shape — includes isActive/audit fields needed for lookups but not exposed to callers. */
async function findLatestStandardRow(companyId: string, dateStr?: string) {
  const asOf = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(asOf.getTime())) {
    throw new Error('Invalid date');
  }
  const dateOnly = new Date(
    Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()),
  );

  return prisma.colorConsumptionStandard.findFirst({
    where: {
      companyId,
      date: {
        lte: dateOnly,
      },
    },
    orderBy: { date: 'desc' },
  });
}

/** The only fields exposed to API callers — companyId/isActive/audit columns stay internal. `id` is included so update/delete can target this record. */
function toPublicStandard(
  record: NonNullable<Awaited<ReturnType<typeof findLatestStandardRow>>>,
) {
  return {
    id: record.id,
    date: record.date,
    basisWeightKg: record.basisWeightKg,
    hdpematerialbag: record.hdpematerialbag,
    whiteKgBasis: record.whiteKgBasis,
    blueKgBasis: record.blueKgBasis,
    greenKgBasis: record.greenKgBasis,
    chemicalWeight: record.chemicalWeight,
  };
}

export async function getLatestColorConsumptionStandard(
  companyId: string,
  dateStr?: string,
) {
  const record = await findLatestStandardRow(companyId, dateStr);
  return record ? toPublicStandard(record) : null;
}

/** Creates a colour consumption standard — one record covers every colour (white/blue/green), not one row per colour. */
export async function createColorConsumptionStandard(
  input: CreateColorConsumptionStandardInput,
  companyId: string,
  actor: string,
) {
  const record = await prisma.colorConsumptionStandard.create({
    data: {
      companyId,
      basisWeightKg: input.basisWeightKg,
      hdpematerialbag: input.hdpematerialbag,
      whiteKgBasis: input.whiteKgBasis,
      blueKgBasis: input.blueKgBasis,
      greenKgBasis: input.greenKgBasis,
      chemicalWeight: input.chemicalWeight,
      date: input.date,
      isActive: input.isActive,
      createdBy: actor,
    },
  });
  return toPublicStandard(record);
}

async function assertStandardExists(id: string, companyId: string): Promise<void> {
  const found = await prisma.colorConsumptionStandard.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!found) {
    throw new NotFoundError('Colour consumption standard not found', 'COLOR_CONSUMPTION_STANDARD_NOT_FOUND', { id });
  }
}

export async function updateColorConsumptionStandard(
  id: string,
  input: UpdateColorConsumptionStandardInput,
  companyId: string,
  actor: string,
) {
  await assertStandardExists(id, companyId);

  const record = await prisma.colorConsumptionStandard.update({
    where: { id },
    data: {
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.basisWeightKg !== undefined ? { basisWeightKg: input.basisWeightKg } : {}),
      ...(input.hdpematerialbag !== undefined ? { hdpematerialbag: input.hdpematerialbag } : {}),
      ...(input.whiteKgBasis !== undefined ? { whiteKgBasis: input.whiteKgBasis } : {}),
      ...(input.blueKgBasis !== undefined ? { blueKgBasis: input.blueKgBasis } : {}),
      ...(input.greenKgBasis !== undefined ? { greenKgBasis: input.greenKgBasis } : {}),
      ...(input.chemicalWeight !== undefined ? { chemicalWeight: input.chemicalWeight } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actor,
    },
  });
  return toPublicStandard(record);
}

export async function deleteColorConsumptionStandard(id: string, companyId: string): Promise<void> {
  await assertStandardExists(id, companyId);
  await prisma.colorConsumptionStandard.delete({ where: { id } });
}

const COLOR_KG_FIELD = {
  white: 'whiteKgBasis',
  blue: 'blueKgBasis',
  green: 'greenKgBasis',
} as const;

/**
 * Resolves the configured kg-per-basis for one named colour (PRD §5) out of
 * the latest active standard as of `asOf`. Colours outside the fixed
 * white/blue/green set (e.g. custom colours added later) have no standard —
 * callers must treat `null` as "not configured", not an error.
 */
export async function getKgPerBasisForColor(companyId: string, colorName: string, asOf?: Date) {
  const field = COLOR_KG_FIELD[colorName.trim().toLowerCase() as keyof typeof COLOR_KG_FIELD];
  if (!field) return null;

  const standard = await findLatestStandardRow(companyId, asOf?.toISOString());
  if (!standard || !standard.isActive) return null;

  return { kgPerBasis: standard[field], basisWeightKg: standard.basisWeightKg };
}
