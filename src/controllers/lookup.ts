import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import * as lookupService from '../services/lookup.js';
import {
  createBrandSchema,
  createChemicalSchema,
  createColorSchema,
  createExpenseNameSchema,
  createSizeSchema,
  lookupIdParamsSchema,
  updateBrandSchema,
  updateChemicalSchema,
  updateColorSchema,
  updateExpenseNameSchema,
  updateSizeSchema,
} from '../validations/lookupValidation.js';

export const getLookups = asyncHandler(async (req: Request, res: Response) => {
  const { companyId } = getAuthContext(req);
  const result = await lookupService.getLookups(companyId);
  res.status(200).json(result);
});

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const createColor = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(createColorSchema, req.body);
  const { companyId, actor } = getAuthContext(req);
  const record = await lookupService.createColor(input, companyId, actor);
  sendSuccess(res, record, undefined, 201);
});

export const updateColor = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(lookupIdParamsSchema, req.params);
  const input = parseOrThrow(updateColorSchema, req.body);
  const { companyId, actor } = getAuthContext(req);
  const record = await lookupService.updateColor(id, input, companyId, actor);
  sendSuccess(res, record);
});

export const deleteColor = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(lookupIdParamsSchema, req.params);
  const { companyId } = getAuthContext(req);
  await lookupService.deleteColor(id, companyId);
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Sizes
// ---------------------------------------------------------------------------

export const createSize = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(createSizeSchema, req.body);
  const { companyId, actor } = getAuthContext(req);
  const record = await lookupService.createSize(input, companyId, actor);
  sendSuccess(res, record, undefined, 201);
});

export const updateSize = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(lookupIdParamsSchema, req.params);
  const input = parseOrThrow(updateSizeSchema, req.body);
  const { companyId, actor } = getAuthContext(req);
  const record = await lookupService.updateSize(id, input, companyId, actor);
  sendSuccess(res, record);
});

export const deleteSize = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(lookupIdParamsSchema, req.params);
  const { companyId } = getAuthContext(req);
  await lookupService.deleteSize(id, companyId);
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Chemicals
// ---------------------------------------------------------------------------

export const createChemical = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(createChemicalSchema, req.body);
  const { companyId, actor } = getAuthContext(req);
  const record = await lookupService.createChemical(input, companyId, actor);
  sendSuccess(res, record, undefined, 201);
});

export const updateChemical = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(lookupIdParamsSchema, req.params);
  const input = parseOrThrow(updateChemicalSchema, req.body);
  const { companyId, actor } = getAuthContext(req);
  const record = await lookupService.updateChemical(id, input, companyId, actor);
  sendSuccess(res, record);
});

export const deleteChemical = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(lookupIdParamsSchema, req.params);
  const { companyId } = getAuthContext(req);
  await lookupService.deleteChemical(id, companyId);
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export const createBrand = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(createBrandSchema, req.body);
  const { companyId, actor } = getAuthContext(req);
  const record = await lookupService.createBrand(input, companyId, actor);
  sendSuccess(res, record, undefined, 201);
});

export const updateBrand = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(lookupIdParamsSchema, req.params);
  const input = parseOrThrow(updateBrandSchema, req.body);
  const { companyId, actor } = getAuthContext(req);
  const record = await lookupService.updateBrand(id, input, companyId, actor);
  sendSuccess(res, record);
});

export const deleteBrand = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(lookupIdParamsSchema, req.params);
  const { companyId } = getAuthContext(req);
  await lookupService.deleteBrand(id, companyId);
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Expense names
// ---------------------------------------------------------------------------

export const createExpenseName = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(createExpenseNameSchema, req.body);
  const { companyId, actor } = getAuthContext(req);
  const record = await lookupService.createExpenseName(input, companyId, actor);
  sendSuccess(res, record, undefined, 201);
});

export const updateExpenseName = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(lookupIdParamsSchema, req.params);
  const input = parseOrThrow(updateExpenseNameSchema, req.body);
  const { companyId, actor } = getAuthContext(req);
  const record = await lookupService.updateExpenseName(id, input, companyId, actor);
  sendSuccess(res, record);
});

export const deleteExpenseName = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(lookupIdParamsSchema, req.params);
  const { companyId } = getAuthContext(req);
  await lookupService.deleteExpenseName(id, companyId);
  res.status(204).send();
});
