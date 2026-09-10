import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import { RightAction } from '../types/enums.js';
import { assertModuleActionAllowed } from '../services/roleAccessService.js';
import {
    createOpeningBalanceWastage,
    createOpeningBalanceWastageBatch,
    deleteOpeningBalanceWastage,
    getOpeningBalanceWastageById,
    listOpeningBalanceWastage,
    updateOpeningBalanceWastage,
} from '../services/openingBalanceWastageService.js';
import {
    batchCreateOpeningBalanceWastageSchema,
    createOpeningBalanceWastageSchema,
    listOpeningBalanceWastageQuerySchema,
    openingBalanceWastageIdParamsSchema,
    updateOpeningBalanceWastageSchema,
} from '../validations/openingBalanceWastageValidation.js';

const ADMIN_PANEL_MODULE_CODE = 'admin_panel';
const OPENING_BALANCE_TAB_CODE = 'opening-balance';

export const createOpeningBalanceWastageHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createOpeningBalanceWastageSchema, req.body);
    const { companyId, actor, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, ADMIN_PANEL_MODULE_CODE, RightAction.ADD, OPENING_BALANCE_TAB_CODE);
    const record = await createOpeningBalanceWastage(input, companyId, actor);
    sendSuccess(res, record, undefined, 201);
});

export const createOpeningBalanceWastageBatchHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(batchCreateOpeningBalanceWastageSchema, req.body);
    const { companyId, actor, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, ADMIN_PANEL_MODULE_CODE, RightAction.ADD, OPENING_BALANCE_TAB_CODE);
    const records = await createOpeningBalanceWastageBatch(input, companyId, actor);
    sendSuccess(res, records, undefined, 201);
});

export const listOpeningBalanceWastageHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listOpeningBalanceWastageQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listOpeningBalanceWastage(query, companyId);
    sendSuccess(res, items, meta);
});

export const getOpeningBalanceWastageHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(openingBalanceWastageIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    const record = await getOpeningBalanceWastageById(id, companyId);
    sendSuccess(res, record);
});

export const updateOpeningBalanceWastageHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(openingBalanceWastageIdParamsSchema, req.params);
    const input = parseOrThrow(updateOpeningBalanceWastageSchema, req.body);
    const { companyId, actor, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, ADMIN_PANEL_MODULE_CODE, RightAction.EDIT, OPENING_BALANCE_TAB_CODE);
    const record = await updateOpeningBalanceWastage(id, input, companyId, actor);
    sendSuccess(res, record);
});

export const deleteOpeningBalanceWastageHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(openingBalanceWastageIdParamsSchema, req.params);
    const { companyId, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, ADMIN_PANEL_MODULE_CODE, RightAction.DELETE, OPENING_BALANCE_TAB_CODE);
    await deleteOpeningBalanceWastage(id, companyId);
    res.status(204).send();
});
