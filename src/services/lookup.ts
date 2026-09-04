import { isUniqueViolation } from '../db/errors.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import {
  createLookupItem,
  deleteLookupItem,
  existsLookupItem,
  listLookupItems,
  updateLookupItem,
} from '../repositories/lookupItem.repository.js';
import type {
  CreateBrandInput,
  CreateChemicalInput,
  CreateColorInput,
  CreateExpenseNameInput,
  CreateSizeInput,
  UpdateBrandInput,
  UpdateChemicalInput,
  UpdateColorInput,
  UpdateExpenseNameInput,
  UpdateSizeInput,
} from '../validations/lookupValidation.js';

export async function getLookups(companyId: string) {
  const [brands, colors, chemicals, sizes, expenseNames] = await Promise.all([
    listLookupItems('brands', companyId),
    listLookupItems('colors', companyId),
    listLookupItems('chemicals', companyId),
    listLookupItems('sizes', companyId),
    listLookupItems('expense_names', companyId),
  ]);

  return { brands, colors, chemicals, sizes, expenseNames };
}

/** Maps a unique-constraint violation on [companyId, name] to a stable conflict error. */
function mapNameConflict(err: unknown, resource: string, code: string): never | undefined {
  if (!isUniqueViolation(err)) return undefined;
  throw new ConflictError(`A ${resource} with this name already exists`, code);
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export async function createColor(input: CreateColorInput, companyId: string, actor: string) {
  try {
    return await createLookupItem('colors', companyId, input.name, actor);
  } catch (err) {
    mapNameConflict(err, 'color', 'COLOR_NAME_EXISTS');
    throw err;
  }
}

async function assertColorExists(id: string, companyId: string): Promise<void> {
  const found = await existsLookupItem('colors', id, companyId);
  if (!found) throw new NotFoundError('Color not found', 'COLOR_NOT_FOUND', { id });
}

export async function updateColor(id: string, input: UpdateColorInput, companyId: string, actor: string) {
  await assertColorExists(id, companyId);
  try {
    return await updateLookupItem('colors', id, input.name, actor);
  } catch (err) {
    mapNameConflict(err, 'color', 'COLOR_NAME_EXISTS');
    throw err;
  }
}

export async function deleteColor(id: string, companyId: string): Promise<void> {
  await assertColorExists(id, companyId);
  await deleteLookupItem('colors', id);
}

// ---------------------------------------------------------------------------
// Sizes
// ---------------------------------------------------------------------------

export async function createSize(input: CreateSizeInput, companyId: string, actor: string) {
  try {
    return await createLookupItem('sizes', companyId, input.name, actor);
  } catch (err) {
    mapNameConflict(err, 'size', 'SIZE_NAME_EXISTS');
    throw err;
  }
}

async function assertSizeExists(id: string, companyId: string): Promise<void> {
  const found = await existsLookupItem('sizes', id, companyId);
  if (!found) throw new NotFoundError('Size not found', 'SIZE_NOT_FOUND', { id });
}

export async function updateSize(id: string, input: UpdateSizeInput, companyId: string, actor: string) {
  await assertSizeExists(id, companyId);
  try {
    return await updateLookupItem('sizes', id, input.name, actor);
  } catch (err) {
    mapNameConflict(err, 'size', 'SIZE_NAME_EXISTS');
    throw err;
  }
}

export async function deleteSize(id: string, companyId: string): Promise<void> {
  await assertSizeExists(id, companyId);
  await deleteLookupItem('sizes', id);
}

// ---------------------------------------------------------------------------
// Chemicals
// ---------------------------------------------------------------------------

export async function createChemical(input: CreateChemicalInput, companyId: string, actor: string) {
  try {
    return await createLookupItem('chemicals', companyId, input.name, actor);
  } catch (err) {
    mapNameConflict(err, 'chemical', 'CHEMICAL_NAME_EXISTS');
    throw err;
  }
}

async function assertChemicalExists(id: string, companyId: string): Promise<void> {
  const found = await existsLookupItem('chemicals', id, companyId);
  if (!found) throw new NotFoundError('Chemical not found', 'CHEMICAL_NOT_FOUND', { id });
}

export async function updateChemical(id: string, input: UpdateChemicalInput, companyId: string, actor: string) {
  await assertChemicalExists(id, companyId);
  try {
    return await updateLookupItem('chemicals', id, input.name, actor);
  } catch (err) {
    mapNameConflict(err, 'chemical', 'CHEMICAL_NAME_EXISTS');
    throw err;
  }
}

export async function deleteChemical(id: string, companyId: string): Promise<void> {
  await assertChemicalExists(id, companyId);
  await deleteLookupItem('chemicals', id);
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export async function createBrand(input: CreateBrandInput, companyId: string, actor: string) {
  try {
    return await createLookupItem('brands', companyId, input.name, actor);
  } catch (err) {
    mapNameConflict(err, 'brand', 'BRAND_NAME_EXISTS');
    throw err;
  }
}

async function assertBrandExists(id: string, companyId: string): Promise<void> {
  const found = await existsLookupItem('brands', id, companyId);
  if (!found) throw new NotFoundError('Brand not found', 'BRAND_NOT_FOUND', { id });
}

export async function updateBrand(id: string, input: UpdateBrandInput, companyId: string, actor: string) {
  await assertBrandExists(id, companyId);
  try {
    return await updateLookupItem('brands', id, input.name, actor);
  } catch (err) {
    mapNameConflict(err, 'brand', 'BRAND_NAME_EXISTS');
    throw err;
  }
}

export async function deleteBrand(id: string, companyId: string): Promise<void> {
  await assertBrandExists(id, companyId);
  await deleteLookupItem('brands', id);
}

// ---------------------------------------------------------------------------
// Expense names
// ---------------------------------------------------------------------------

export async function createExpenseName(input: CreateExpenseNameInput, companyId: string, actor: string) {
  try {
    return await createLookupItem('expense_names', companyId, input.name, actor);
  } catch (err) {
    mapNameConflict(err, 'expense name', 'EXPENSE_NAME_EXISTS');
    throw err;
  }
}

async function assertExpenseNameExists(id: string, companyId: string): Promise<void> {
  const found = await existsLookupItem('expense_names', id, companyId);
  if (!found) throw new NotFoundError('Expense name not found', 'EXPENSE_NAME_NOT_FOUND', { id });
}

export async function updateExpenseName(id: string, input: UpdateExpenseNameInput, companyId: string, actor: string) {
  await assertExpenseNameExists(id, companyId);
  try {
    return await updateLookupItem('expense_names', id, input.name, actor);
  } catch (err) {
    mapNameConflict(err, 'expense name', 'EXPENSE_NAME_EXISTS');
    throw err;
  }
}

export async function deleteExpenseName(id: string, companyId: string): Promise<void> {
  await assertExpenseNameExists(id, companyId);
  await deleteLookupItem('expense_names', id);
}
