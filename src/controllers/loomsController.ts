import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getActor } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import { createLoomsProduction, getLoomsProductionById, listLoomsProductions } from '../services/loomsService.js';
import { createLoomsSchema, listLoomsQuerySchema, loomsIdParamsSchema } from '../validations/loomsValidation.js';

export const createLooms = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createLoomsSchema, req.body);
    const record = await createLoomsProduction(input, getActor(req));
    sendSuccess(res, record, undefined, 201);
});

export const listLooms = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listLoomsQuerySchema, req.query);
    const { items, meta } = await listLoomsProductions(query);
    sendSuccess(res, items, meta);
});

export const getLooms = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(loomsIdParamsSchema, req.params);
    const record = await getLoomsProductionById(id);
    sendSuccess(res, record);
});
