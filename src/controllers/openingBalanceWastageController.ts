import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
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

export const createOpeningBalanceWastageHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createOpeningBalanceWastageSchema, req.body);
    const { companyId, actor } = getAuthContext(req);
    const record = await createOpeningBalanceWastage(input, companyId, actor);
    sendSuccess(res, record, undefined, 201);
});

export const createOpeningBalanceWastageBatchHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(batchCreateOpeningBalanceWastageSchema, req.body);
    const { companyId, actor } = getAuthContext(req);
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
    const { companyId, actor } = getAuthContext(req);
    const record = await updateOpeningBalanceWastage(id, input, companyId, actor);
    sendSuccess(res, record);
});

export const deleteOpeningBalanceWastageHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(openingBalanceWastageIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    await deleteOpeningBalanceWastage(id, companyId);
    res.status(204).send();
});
