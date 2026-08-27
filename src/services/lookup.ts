import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import type {
  CreateBrandInput,
  CreateChemicalInput,
  CreateColorInput,
  CreateSizeInput,
  UpdateBrandInput,
  UpdateChemicalInput,
  UpdateColorInput,
  UpdateSizeInput,
} from '../validations/lookupValidation.js';

export async function getLookups(companyId: string) {
  const lookupSelect = { id: true, itemCode: true, name: true, createdAt: true, updatedAt: true };

  const [brands, colors, chemicals, sizes] = await Promise.all([
    prisma.brand.findMany({ where: { companyId }, select: lookupSelect, orderBy: { name: 'asc' } }),
    prisma.color.findMany({ where: { companyId }, select: lookupSelect, orderBy: { name: 'asc' } }),
    prisma.chemical.findMany({ where: { companyId }, select: lookupSelect, orderBy: { name: 'asc' } }),
    prisma.size.findMany({ where: { companyId }, select: lookupSelect, orderBy: { name: 'asc' } }),
  ]);

  return { brands, colors, chemicals, sizes };
}

/** Maps a unique-constraint violation on [companyId, name] to a stable conflict error. */
function mapNameConflict(err: unknown, resource: string, code: string): never | undefined {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return undefined;
  throw new ConflictError(`A ${resource} with this name already exists`, code);
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

/** Atomically assigns the next colour itemCode: "CR" + a zero-padded per-company sequence. Mirrors userService.nextCustomUserId. */
async function nextColorCode(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const company = await tx.company.update({
    where: { id: companyId },
    data: { colorSeq: { increment: 1 } },
    select: { colorSeq: true },
  });
  return `CR${String(company.colorSeq - 1).padStart(3, '0')}`;
}

export async function createColor(input: CreateColorInput, companyId: string, actor: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const itemCode = await nextColorCode(tx, companyId);
      return tx.color.create({
        data: { companyId, itemCode, name: input.name, createdBy: actor },
        select: { id: true, itemCode: true, name: true, createdAt: true, updatedAt: true },
      });
    });
  } catch (err) {
    mapNameConflict(err, 'color', 'COLOR_NAME_EXISTS');
    throw err;
  }
}

async function assertColorExists(id: string, companyId: string): Promise<void> {
  const found = await prisma.color.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!found) throw new NotFoundError('Color not found', 'COLOR_NOT_FOUND', { id });
}

export async function updateColor(id: string, input: UpdateColorInput, companyId: string, actor: string) {
  await assertColorExists(id, companyId);
  try {
    return await prisma.color.update({
      where: { id },
      data: { name: input.name, updatedBy: actor },
      select: { id: true, itemCode: true, name: true, createdAt: true, updatedAt: true },
    });
  } catch (err) {
    mapNameConflict(err, 'color', 'COLOR_NAME_EXISTS');
    throw err;
  }
}

export async function deleteColor(id: string, companyId: string): Promise<void> {
  await assertColorExists(id, companyId);
  await prisma.color.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Sizes
// ---------------------------------------------------------------------------

/** Atomically assigns the next size itemCode: "SE" + a zero-padded per-company sequence. */
async function nextSizeCode(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const company = await tx.company.update({
    where: { id: companyId },
    data: { sizeSeq: { increment: 1 } },
    select: { sizeSeq: true },
  });
  return `SE${String(company.sizeSeq - 1).padStart(3, '0')}`;
}

export async function createSize(input: CreateSizeInput, companyId: string, actor: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const itemCode = await nextSizeCode(tx, companyId);
      return tx.size.create({
        data: { companyId, itemCode, name: input.name, createdBy: actor },
        select: { id: true, itemCode: true, name: true, createdAt: true, updatedAt: true },
      });
    });
  } catch (err) {
    mapNameConflict(err, 'size', 'SIZE_NAME_EXISTS');
    throw err;
  }
}

async function assertSizeExists(id: string, companyId: string): Promise<void> {
  const found = await prisma.size.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!found) throw new NotFoundError('Size not found', 'SIZE_NOT_FOUND', { id });
}

export async function updateSize(id: string, input: UpdateSizeInput, companyId: string, actor: string) {
  await assertSizeExists(id, companyId);
  try {
    return await prisma.size.update({
      where: { id },
      data: { name: input.name, updatedBy: actor },
      select: { id: true, itemCode: true, name: true, createdAt: true, updatedAt: true },
    });
  } catch (err) {
    mapNameConflict(err, 'size', 'SIZE_NAME_EXISTS');
    throw err;
  }
}

export async function deleteSize(id: string, companyId: string): Promise<void> {
  await assertSizeExists(id, companyId);
  await prisma.size.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Chemicals
// ---------------------------------------------------------------------------

/** Atomically assigns the next chemical itemCode: "CL" + a zero-padded per-company sequence. */
async function nextChemicalCode(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const company = await tx.company.update({
    where: { id: companyId },
    data: { chemicalSeq: { increment: 1 } },
    select: { chemicalSeq: true },
  });
  return `CL${String(company.chemicalSeq - 1).padStart(3, '0')}`;
}

export async function createChemical(input: CreateChemicalInput, companyId: string, actor: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const itemCode = await nextChemicalCode(tx, companyId);
      return tx.chemical.create({
        data: { companyId, itemCode, name: input.name, createdBy: actor },
        select: { id: true, itemCode: true, name: true, createdAt: true, updatedAt: true },
      });
    });
  } catch (err) {
    mapNameConflict(err, 'chemical', 'CHEMICAL_NAME_EXISTS');
    throw err;
  }
}

async function assertChemicalExists(id: string, companyId: string): Promise<void> {
  const found = await prisma.chemical.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!found) throw new NotFoundError('Chemical not found', 'CHEMICAL_NOT_FOUND', { id });
}

export async function updateChemical(id: string, input: UpdateChemicalInput, companyId: string, actor: string) {
  await assertChemicalExists(id, companyId);
  try {
    return await prisma.chemical.update({
      where: { id },
      data: { name: input.name, updatedBy: actor },
      select: { id: true, itemCode: true, name: true, createdAt: true, updatedAt: true },
    });
  } catch (err) {
    mapNameConflict(err, 'chemical', 'CHEMICAL_NAME_EXISTS');
    throw err;
  }
}

export async function deleteChemical(id: string, companyId: string): Promise<void> {
  await assertChemicalExists(id, companyId);
  await prisma.chemical.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

/** Atomically assigns the next brand itemCode: "BD" + a zero-padded per-company sequence. */
async function nextBrandCode(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const company = await tx.company.update({
    where: { id: companyId },
    data: { brandSeq: { increment: 1 } },
    select: { brandSeq: true },
  });
  return `BD${String(company.brandSeq - 1).padStart(3, '0')}`;
}

export async function createBrand(input: CreateBrandInput, companyId: string, actor: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const itemCode = await nextBrandCode(tx, companyId);
      return tx.brand.create({
        data: { companyId, itemCode, name: input.name, createdBy: actor },
        select: { id: true, itemCode: true, name: true, createdAt: true, updatedAt: true },
      });
    });
  } catch (err) {
    mapNameConflict(err, 'brand', 'BRAND_NAME_EXISTS');
    throw err;
  }
}

async function assertBrandExists(id: string, companyId: string): Promise<void> {
  const found = await prisma.brand.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!found) throw new NotFoundError('Brand not found', 'BRAND_NOT_FOUND', { id });
}

export async function updateBrand(id: string, input: UpdateBrandInput, companyId: string, actor: string) {
  await assertBrandExists(id, companyId);
  try {
    return await prisma.brand.update({
      where: { id },
      data: { name: input.name, updatedBy: actor },
      select: { id: true, itemCode: true, name: true, createdAt: true, updatedAt: true },
    });
  } catch (err) {
    mapNameConflict(err, 'brand', 'BRAND_NAME_EXISTS');
    throw err;
  }
}

export async function deleteBrand(id: string, companyId: string): Promise<void> {
  await assertBrandExists(id, companyId);
  await prisma.brand.delete({ where: { id } });
}
