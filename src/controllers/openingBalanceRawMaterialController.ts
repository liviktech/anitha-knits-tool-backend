import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import { RightAction } from '../types/enums.js';
import { assertModuleActionAllowed } from '../services/roleAccessService.js';
import {
    createOpeningBalanceRawMaterialGroup,
    deleteOpeningBalanceRawMaterialGroup,
    listOpeningBalanceRawMaterials,
    replaceOpeningBalanceRawMaterialGroup,
} from '../services/openingBalanceRawMaterialService.js';
import {
    createOpeningBalanceRawMaterialSchema,
    listOpeningBalanceRawMaterialQuerySchema,
    openingBalanceRawMaterialGroupIdParamsSchema,
    updateOpeningBalanceRawMaterialSchema,
} from '../validations/openingBalanceRawMaterialValidation.js';

const ADMIN_PANEL_MODULE_CODE = 'admin_panel';
const OPENING_BALANCE_TAB_CODE = 'opening-balance';

export const createOpeningBalanceRawMaterialHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createOpeningBalanceRawMaterialSchema, req.body);
    const { companyId, actor, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, ADMIN_PANEL_MODULE_CODE, RightAction.ADD, OPENING_BALANCE_TAB_CODE);
    const records = await createOpeningBalanceRawMaterialGroup(input, companyId, actor);
    sendSuccess(res, records, undefined, 201);
});

export const listOpeningBalanceRawMaterialsHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listOpeningBalanceRawMaterialQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listOpeningBalanceRawMaterials(query, companyId);
    sendSuccess(res, items, meta);
});

export const replaceOpeningBalanceRawMaterialGroupHandler = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = parseOrThrow(openingBalanceRawMaterialGroupIdParamsSchema, req.params);
    const input = parseOrThrow(updateOpeningBalanceRawMaterialSchema, req.body);
    const { companyId, actor, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, ADMIN_PANEL_MODULE_CODE, RightAction.EDIT, OPENING_BALANCE_TAB_CODE);
    const records = await replaceOpeningBalanceRawMaterialGroup(groupId, input, companyId, actor);
    sendSuccess(res, records);
});

export const deleteOpeningBalanceRawMaterialGroupHandler = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = parseOrThrow(openingBalanceRawMaterialGroupIdParamsSchema, req.params);
    const { companyId, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, ADMIN_PANEL_MODULE_CODE, RightAction.DELETE, OPENING_BALANCE_TAB_CODE);
    await deleteOpeningBalanceRawMaterialGroup(groupId, companyId);
    res.status(204).send();
});
