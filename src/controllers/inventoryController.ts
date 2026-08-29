import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    createInventory,
    deleteInventory,
    getInventoryById,
    listInventory,
    updateInventory,
} from '../services/inventoryService.js';
import {
    createInventorySchema,
    inventoryIdParamsSchema,
    listInventoryQuerySchema,
    updateInventorySchema,
} from '../validations/inventoryValidation.js';

export const createInventoryHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createInventorySchema, req.body);
    const { companyId, actor, role, userId } = getAuthContext(req);
    const record = await createInventory(input, companyId, actor, role, userId);
    sendSuccess(res, record, undefined, 201);
});

export const listInventoryHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listInventoryQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listInventory(query, companyId);
    sendSuccess(res, items, meta);
});

export const getInventoryHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(inventoryIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    const record = await getInventoryById(id, companyId);
    sendSuccess(res, record);
});

export const updateInventoryHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(inventoryIdParamsSchema, req.params);
    const input = parseOrThrow(updateInventorySchema, req.body);
    const { companyId, actor, role, userId } = getAuthContext(req);
    const record = await updateInventory(id, input, companyId, actor, role, userId);
    sendSuccess(res, record);
});

export const deleteInventoryHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(inventoryIdParamsSchema, req.params);
    const { companyId, role, userId } = getAuthContext(req);
    await deleteInventory(id, companyId, role, userId);
    res.status(204).send();
});
