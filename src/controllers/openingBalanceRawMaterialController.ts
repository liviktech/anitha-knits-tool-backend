import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
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

export const createOpeningBalanceRawMaterialHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createOpeningBalanceRawMaterialSchema, req.body);
    const { companyId, actor } = getAuthContext(req);
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
    const { companyId, actor } = getAuthContext(req);
    const records = await replaceOpeningBalanceRawMaterialGroup(groupId, input, companyId, actor);
    sendSuccess(res, records);
});

export const deleteOpeningBalanceRawMaterialGroupHandler = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = parseOrThrow(openingBalanceRawMaterialGroupIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    await deleteOpeningBalanceRawMaterialGroup(groupId, companyId);
    res.status(204).send();
});
