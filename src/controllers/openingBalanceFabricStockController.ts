import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    createOpeningBalanceFabricStock,
    createOpeningBalanceFabricStockBatch,
    deleteOpeningBalanceFabricStock,
    getOpeningBalanceFabricStockById,
    listOpeningBalanceFabricStock,
    updateOpeningBalanceFabricStock,
} from '../services/openingBalanceFabricStockService.js';
import {
    batchCreateOpeningBalanceFabricStockSchema,
    createOpeningBalanceFabricStockSchema,
    listOpeningBalanceFabricStockQuerySchema,
    openingBalanceFabricStockIdParamsSchema,
    updateOpeningBalanceFabricStockSchema,
} from '../validations/openingBalanceFabricStockValidation.js';

export const createOpeningBalanceFabricStockHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createOpeningBalanceFabricStockSchema, req.body);
    const { companyId, actor } = getAuthContext(req);
    const record = await createOpeningBalanceFabricStock(input, companyId, actor);
    sendSuccess(res, record, undefined, 201);
});

export const createOpeningBalanceFabricStockBatchHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(batchCreateOpeningBalanceFabricStockSchema, req.body);
    const { companyId, actor } = getAuthContext(req);
    const records = await createOpeningBalanceFabricStockBatch(input, companyId, actor);
    sendSuccess(res, records, undefined, 201);
});

export const listOpeningBalanceFabricStockHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listOpeningBalanceFabricStockQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listOpeningBalanceFabricStock(query, companyId);
    sendSuccess(res, items, meta);
});

export const getOpeningBalanceFabricStockHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(openingBalanceFabricStockIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    const record = await getOpeningBalanceFabricStockById(id, companyId);
    sendSuccess(res, record);
});

export const updateOpeningBalanceFabricStockHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(openingBalanceFabricStockIdParamsSchema, req.params);
    const input = parseOrThrow(updateOpeningBalanceFabricStockSchema, req.body);
    const { companyId, actor } = getAuthContext(req);
    const record = await updateOpeningBalanceFabricStock(id, input, companyId, actor);
    sendSuccess(res, record);
});

export const deleteOpeningBalanceFabricStockHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(openingBalanceFabricStockIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    await deleteOpeningBalanceFabricStock(id, companyId);
    res.status(204).send();
});
