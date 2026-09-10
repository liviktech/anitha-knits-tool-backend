import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import { RightAction } from '../types/enums.js';
import { assertModuleActionAllowed } from '../services/roleAccessService.js';
import {
  createColorConsumptionStandard,
  deleteColorConsumptionStandard,
  getLatestColorConsumptionStandard,
  listColorConsumptionStandards,
  updateColorConsumptionStandard,
} from '../services/adminConfig.js';
import {
  colorConsumptionStandardIdParamsSchema,
  createColorConsumptionStandardSchema,
  listColorConsumptionStandardsQuerySchema,
  updateColorConsumptionStandardSchema,
} from '../validations/adminConfigValidation.js';

const ADMIN_PANEL_MODULE_CODE = 'admin_panel';
const PRODUCTION_CONFIG_TAB_CODE = 'production-config';

export const getLatestColorConsumption = asyncHandler(
  async (req: Request, res: Response) => {
    const { companyId } = getAuthContext(req);
    const date =
      typeof req.query.date === 'string' ? req.query.date : undefined;
    const record = await getLatestColorConsumptionStandard(companyId, date);
    sendSuccess(res, record);
  },
);

export const listColorConsumption = asyncHandler(
  async (req: Request, res: Response) => {
    const query = parseOrThrow(listColorConsumptionStandardsQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listColorConsumptionStandards(companyId, query);
    sendSuccess(res, items, meta);
  },
);

export const createColorConsumption = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseOrThrow(createColorConsumptionStandardSchema, req.body);
    const { companyId, actor, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, ADMIN_PANEL_MODULE_CODE, RightAction.ADD, PRODUCTION_CONFIG_TAB_CODE);
    const record = await createColorConsumptionStandard(input, companyId, actor);
    sendSuccess(res, record, undefined, 201);
  },
);

export const updateColorConsumption = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = parseOrThrow(colorConsumptionStandardIdParamsSchema, req.params);
    const input = parseOrThrow(updateColorConsumptionStandardSchema, req.body);
    const { companyId, actor, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, ADMIN_PANEL_MODULE_CODE, RightAction.EDIT, PRODUCTION_CONFIG_TAB_CODE);
    const record = await updateColorConsumptionStandard(id, input, companyId, actor);
    sendSuccess(res, record);
  },
);

export const deleteColorConsumption = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = parseOrThrow(colorConsumptionStandardIdParamsSchema, req.params);
    const { companyId, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, ADMIN_PANEL_MODULE_CODE, RightAction.DELETE, PRODUCTION_CONFIG_TAB_CODE);
    await deleteColorConsumptionStandard(id, companyId);
    res.status(204).send();
  },
);
