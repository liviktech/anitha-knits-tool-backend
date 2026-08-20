import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getActor } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    createLoadSent,
    deleteLoadSent,
    getLoadSentById,
    listLoadSent,
    updateLoadSent,
} from '../services/loadSentService.js';
import {
    createLoadSentSchema,
    listLoadSentQuerySchema,
    loadSentIdParamsSchema,
    updateLoadSentSchema,
} from '../validations/loadSentValidation.js';

export const createLoadSentHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createLoadSentSchema, req.body);
    const record = await createLoadSent(input, getActor(req));
    sendSuccess(res, record, undefined, 201);
});

export const listLoadSentHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listLoadSentQuerySchema, req.query);
    const { items, meta } = await listLoadSent(query);
    sendSuccess(res, items, meta);
});

export const getLoadSentHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(loadSentIdParamsSchema, req.params);
    const record = await getLoadSentById(id);
    sendSuccess(res, record);
});

export const updateLoadSentHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(loadSentIdParamsSchema, req.params);
    const input = parseOrThrow(updateLoadSentSchema, req.body);
    const record = await updateLoadSent(id, input, getActor(req));
    sendSuccess(res, record);
});

export const deleteLoadSentHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(loadSentIdParamsSchema, req.params);
    await deleteLoadSent(id);
    res.status(204).send();
});
