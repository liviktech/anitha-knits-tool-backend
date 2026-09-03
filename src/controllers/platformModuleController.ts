import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    createPlatformModule,
    deletePlatformModule,
    getPlatformModuleById,
    listPlatformModules,
    updatePlatformModule,
} from '../services/platformModuleService.js';
import {
    createPlatformModuleSchema,
    listPlatformModuleQuerySchema,
    platformModuleIdParamsSchema,
    updatePlatformModuleSchema,
} from '../validations/platformModuleValidation.js';

export const createPlatformModuleHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createPlatformModuleSchema, req.body);
    const record = await createPlatformModule(input);
    sendSuccess(res, record, undefined, 201);
});

export const listPlatformModulesHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listPlatformModuleQuerySchema, req.query);
    const { items, meta } = await listPlatformModules(query);
    sendSuccess(res, items, meta);
});

export const getPlatformModuleHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(platformModuleIdParamsSchema, req.params);
    const record = await getPlatformModuleById(id);
    sendSuccess(res, record);
});

export const updatePlatformModuleHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(platformModuleIdParamsSchema, req.params);
    const input = parseOrThrow(updatePlatformModuleSchema, req.body);
    const record = await updatePlatformModule(id, input);
    sendSuccess(res, record);
});

export const deletePlatformModuleHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(platformModuleIdParamsSchema, req.params);
    await deletePlatformModule(id);
    res.status(204).send();
});
