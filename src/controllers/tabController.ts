import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    createTab,
    deleteTab,
    getTabById,
    listTabs,
    updateTab,
} from '../services/tabService.js';
import {
    createTabSchema,
    listTabQuerySchema,
    tabIdParamsSchema,
    updateTabSchema,
} from '../validations/tabValidation.js';

export const createTabHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createTabSchema, req.body);
    const { companyId } = getAuthContext(req);
    const record = await createTab(input, companyId);
    sendSuccess(res, record, undefined, 201);
});

export const listTabsHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listTabQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listTabs(query, companyId);
    sendSuccess(res, items, meta);
});

export const getTabHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(tabIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    const record = await getTabById(id, companyId);
    sendSuccess(res, record);
});

export const updateTabHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(tabIdParamsSchema, req.params);
    const input = parseOrThrow(updateTabSchema, req.body);
    const { companyId } = getAuthContext(req);
    const record = await updateTab(id, input, companyId);
    sendSuccess(res, record);
});

export const deleteTabHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(tabIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    await deleteTab(id, companyId);
    res.status(204).send();
});
