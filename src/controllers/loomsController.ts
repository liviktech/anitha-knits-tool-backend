import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    createLoomsProduction,
    getLoomsProductionById,
    listLoomsProductions,
    updateLoomsProduction,
} from '../services/loomsService.js';
import {
    createLoomsSchema,
    listLoomsQuerySchema,
    loomsIdParamsSchema,
    updateLoomsSchema,
} from '../validations/loomsValidation.js';

export const createLooms = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createLoomsSchema, req.body);
    const { companyId, actor } = getAuthContext(req);
    const record = await createLoomsProduction(input, companyId, actor);
    sendSuccess(res, record, undefined, 201);
});

export const listLooms = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listLoomsQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listLoomsProductions(query, companyId);
    sendSuccess(res, items, meta);
});

export const getLooms = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(loomsIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    const record = await getLoomsProductionById(id, companyId);
    sendSuccess(res, record);
});

export const updateLooms = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(loomsIdParamsSchema, req.params);
    const input = parseOrThrow(updateLoomsSchema, req.body);
    const { companyId, actor } = getAuthContext(req);
    const record = await updateLoomsProduction(id, input, companyId, actor);
    sendSuccess(res, record);
});
