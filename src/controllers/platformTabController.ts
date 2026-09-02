import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    createPlatformTab,
    deletePlatformTab,
    getPlatformTabById,
    listPlatformTabs,
    updatePlatformTab,
} from '../services/platformTabService.js';
import {
    createPlatformTabSchema,
    listPlatformTabQuerySchema,
    platformTabIdParamsSchema,
    updatePlatformTabSchema,
} from '../validations/platformTabValidation.js';

export const createPlatformTabHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createPlatformTabSchema, req.body);
    const record = await createPlatformTab(input);
    sendSuccess(res, record, undefined, 201);
});

export const listPlatformTabsHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listPlatformTabQuerySchema, req.query);
    const { items, meta } = await listPlatformTabs(query);
    sendSuccess(res, items, meta);
});

export const getPlatformTabHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(platformTabIdParamsSchema, req.params);
    const record = await getPlatformTabById(id);
    sendSuccess(res, record);
});

export const updatePlatformTabHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(platformTabIdParamsSchema, req.params);
    const input = parseOrThrow(updatePlatformTabSchema, req.body);
    const record = await updatePlatformTab(id, input);
    sendSuccess(res, record);
});

export const deletePlatformTabHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(platformTabIdParamsSchema, req.params);
    await deletePlatformTab(id);
    res.status(204).send();
});
