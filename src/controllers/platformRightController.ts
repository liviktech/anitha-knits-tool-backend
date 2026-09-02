import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    createPlatformRight,
    deletePlatformRight,
    getPlatformRightById,
    listPlatformRights,
    updatePlatformRight,
} from '../services/platformRightService.js';
import {
    createPlatformRightSchema,
    listPlatformRightQuerySchema,
    platformRightIdParamsSchema,
    updatePlatformRightSchema,
} from '../validations/platformRightValidation.js';

export const createPlatformRightHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createPlatformRightSchema, req.body);
    const record = await createPlatformRight(input);
    sendSuccess(res, record, undefined, 201);
});

export const listPlatformRightsHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listPlatformRightQuerySchema, req.query);
    const { items, meta } = await listPlatformRights(query);
    sendSuccess(res, items, meta);
});

export const getPlatformRightHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(platformRightIdParamsSchema, req.params);
    const record = await getPlatformRightById(id);
    sendSuccess(res, record);
});

export const updatePlatformRightHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(platformRightIdParamsSchema, req.params);
    const input = parseOrThrow(updatePlatformRightSchema, req.body);
    const record = await updatePlatformRight(id, input);
    sendSuccess(res, record);
});

export const deletePlatformRightHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(platformRightIdParamsSchema, req.params);
    await deletePlatformRight(id);
    res.status(204).send();
});
