import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import type {
  CreateColorConsumptionStandardInput,
  ListColorConsumptionStandardsQuery,
  UpdateColorConsumptionStandardInput,
} from '../validations/adminConfigValidation.js';

/** Internal row shape — includes isActive/audit fields needed for lookups but not exposed to callers. */
async function findLatestStandardRow(
  companyId: string,
  date?: string | Date,
) {
  const dateOnly =
    date instanceof Date
      ? new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
          ),
        )
      : date
        ? new Date(`${date}T00:00:00.000Z`)
        : new Date();

  if (Number.isNaN(dateOnly.getTime())) {
    throw new Error('Invalid date');
  }

  return prisma.colorConsumptionStandard.findFirst({
    where: {
      companyId,
      date: {
        lte: dateOnly,
      },
    },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' },
    ],
  });
}

/**
 * The only fields exposed to API callers — companyId/isActive/audit columns stay internal.
 * `id` is included so update/delete can target this record. Decimal fields are converted to
 * numbers explicitly — Prisma's Decimal serializes to a JSON string otherwise, not a number.
 */
function toPublicStandard(
  record: NonNullable<Awaited<ReturnType<typeof findLatestStandardRow>>>,
) {
  return {
    id: record.id,
    date: record.date,
    basisWeightKg: record.basisWeightKg.toNumber(),
    hdpematerialbag: record.hdpematerialbag,
    whiteKgBasis: record.whiteKgBasis.toNumber(),
    blueKgBasis: record.blueKgBasis.toNumber(),
    greenKgBasis: record.greenKgBasis.toNumber(),
    chemicalWeight: record.chemicalWeight ? record.chemicalWeight.toNumber() : null,
  };
}

export async function getLatestColorConsumptionStandard(
  companyId: string,
  dateStr?: string,
) {
  const record = await findLatestStandardRow(companyId, dateStr);
  return record ? toPublicStandard(record) : null;
}

/** Configuration history — every standard ever recorded for this company, most recent first. */
export async function listColorConsumptionStandards(
  companyId: string,
  query: ListColorConsumptionStandardsQuery,
) {
  const { skip, take } = toSkipTake(query);
  const where = { companyId };

  const [rows, total] = await prisma.$transaction([
    prisma.colorConsumptionStandard.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    }),
    prisma.colorConsumptionStandard.count({ where }),
  ]);

  return { items: rows.map(toPublicStandard), meta: toPageMeta(query, total) };
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
