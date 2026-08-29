import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    createRight,
    deleteRight,
    getRightById,
    listRights,
    updateRight,
} from '../services/rightService.js';
import {
    createRightSchema,
    listRightQuerySchema,
    rightIdParamsSchema,
    updateRightSchema,
} from '../validations/rightValidation.js';

export const createRightHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createRightSchema, req.body);
    const { companyId } = getAuthContext(req);
    const record = await createRight(input, companyId);
    sendSuccess(res, record, undefined, 201);
});

export const listRightsHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listRightQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listRights(query, companyId);
    sendSuccess(res, items, meta);
});

export const getRightHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(rightIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    const record = await getRightById(id, companyId);
    sendSuccess(res, record);
});

export const updateRightHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(rightIdParamsSchema, req.params);
    const input = parseOrThrow(updateRightSchema, req.body);
    const { companyId } = getAuthContext(req);
    const record = await updateRight(id, input, companyId);
    sendSuccess(res, record);
});

export const deleteRightHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(rightIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    await deleteRight(id, companyId);
    res.status(204).send();
});
