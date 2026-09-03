import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import {
  deleteColorConsumptionStandard as deleteStandardRepo,
  existsStandardInCompany,
  findLatestStandardRow,
  insertColorConsumptionStandard,
  listColorConsumptionStandards as listStandardsRepo,
  updateColorConsumptionStandard as updateStandardRepo,
  type ColorConsumptionStandardRow,
} from '../repositories/colorConsumptionStandard.repository.js';
import type {
  CreateColorConsumptionStandardInput,
  ListColorConsumptionStandardsQuery,
  UpdateColorConsumptionStandardInput,
} from '../validations/adminConfigValidation.js';

function resolveDateOnly(date?: string | Date): Date {
  const dateOnly =
    date instanceof Date
      ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
      : date
        ? new Date(`${date}T00:00:00.000Z`)
        : new Date();

  if (Number.isNaN(dateOnly.getTime())) {
    throw new Error('Invalid date');
  }
  return dateOnly;
}

/**
 * The only fields exposed to API callers — companyId/isActive/audit columns stay internal.
 * `id` is included so update/delete can target this record.
 */
function toPublicStandard(record: ColorConsumptionStandardRow) {
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

export async function getLatestColorConsumptionStandard(companyId: string, dateStr?: string) {
  const record = await findLatestStandardRow(companyId, resolveDateOnly(dateStr));
  return record ? toPublicStandard(record) : null;
}

/** Configuration history — every standard ever recorded for this company, most recent first. */
export async function listColorConsumptionStandards(companyId: string, query: ListColorConsumptionStandardsQuery) {
  const { skip, take } = toSkipTake(query);
  const { rows, total } = await listStandardsRepo(companyId, skip, take);
  return { items: rows.map(toPublicStandard), meta: toPageMeta(query, total) };
}

/** Creates a colour consumption standard — one record covers every colour (white/blue/green), not one row per colour. */
export async function createColorConsumptionStandard(input: CreateColorConsumptionStandardInput, companyId: string, actor: string) {
  const record = await insertColorConsumptionStandard({
    companyId,
    basisWeightKg: input.basisWeightKg,
    hdpematerialbag: input.hdpematerialbag,
    whiteKgBasis: input.whiteKgBasis,
    blueKgBasis: input.blueKgBasis,
    greenKgBasis: input.greenKgBasis,
    chemicalWeight: input.chemicalWeight,
    date: input.date,
    isActive: input.isActive,
    actor,
  });
  return toPublicStandard(record);
}

async function assertStandardExists(id: string, companyId: string): Promise<void> {
  const found = await existsStandardInCompany(id, companyId);
  if (!found) {
    throw new NotFoundError('Colour consumption standard not found', 'COLOR_CONSUMPTION_STANDARD_NOT_FOUND', { id });
  }
}

export async function updateColorConsumptionStandard(id: string, input: UpdateColorConsumptionStandardInput, companyId: string, actor: string) {
  await assertStandardExists(id, companyId);

  const record = await updateStandardRepo(
    id,
    {
      date: input.date,
      basisWeightKg: input.basisWeightKg,
      hdpematerialbag: input.hdpematerialbag,
      whiteKgBasis: input.whiteKgBasis,
      blueKgBasis: input.blueKgBasis,
      greenKgBasis: input.greenKgBasis,
      chemicalWeight: input.chemicalWeight,
      isActive: input.isActive,
    },
    actor,
  );
  return toPublicStandard(record);
}

export async function deleteColorConsumptionStandard(id: string, companyId: string): Promise<void> {
  await assertStandardExists(id, companyId);
  await deleteStandardRepo(id);
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

  const standard = await findLatestStandardRow(companyId, resolveDateOnly(asOf));
  if (!standard || !standard.isActive) return null;

  return { kgPerBasis: standard[field], basisWeightKg: standard.basisWeightKg };
}
