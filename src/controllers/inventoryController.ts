import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getActor } from '../utils/actor.js';
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
    const record = await createInventory(input, getActor(req));
    sendSuccess(res, record, undefined, 201);
});

export const listInventoryHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listInventoryQuerySchema, req.query);
    const { items, meta } = await listInventory(query);
    sendSuccess(res, items, meta);
});

export const getInventoryHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(inventoryIdParamsSchema, req.params);
    const record = await getInventoryById(id);
    sendSuccess(res, record);
});

export const updateInventoryHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(inventoryIdParamsSchema, req.params);
    const input = parseOrThrow(updateInventorySchema, req.body);
    const record = await updateInventory(id, input, getActor(req));
    sendSuccess(res, record);
});

export const deleteInventoryHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(inventoryIdParamsSchema, req.params);
    await deleteInventory(id);
    res.status(204).send();
});
