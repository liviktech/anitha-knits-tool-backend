import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import {
  createColorConsumptionStandard,
  deleteColorConsumptionStandard,
  getLatestColorConsumptionStandard,
  updateColorConsumptionStandard,
} from '../services/adminConfig.js';
import {
  colorConsumptionStandardIdParamsSchema,
  createColorConsumptionStandardSchema,
  updateColorConsumptionStandardSchema,
} from '../validations/adminConfigValidation.js';

export const getLatestColorConsumption = asyncHandler(
  async (req: Request, res: Response) => {
    const { companyId } = getAuthContext(req);
    const date =
      typeof req.query.date === 'string' ? req.query.date : undefined;
    const record = await getLatestColorConsumptionStandard(companyId, date);
    sendSuccess(res, record);
  },
);

export const createColorConsumption = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseOrThrow(createColorConsumptionStandardSchema, req.body);
    const { companyId, actor } = getAuthContext(req);
    const record = await createColorConsumptionStandard(input, companyId, actor);
    sendSuccess(res, record, undefined, 201);
  },
);

export const updateColorConsumption = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = parseOrThrow(colorConsumptionStandardIdParamsSchema, req.params);
    const input = parseOrThrow(updateColorConsumptionStandardSchema, req.body);
    const { companyId, actor } = getAuthContext(req);
    const record = await updateColorConsumptionStandard(id, input, companyId, actor);
    sendSuccess(res, record);
  },
);

export const deleteColorConsumption = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = parseOrThrow(colorConsumptionStandardIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    await deleteColorConsumptionStandard(id, companyId);
    res.status(204).send();
  },
);
