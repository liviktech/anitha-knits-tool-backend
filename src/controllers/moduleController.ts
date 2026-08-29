import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    createModule,
    deleteModule,
    getModuleById,
    listModules,
    updateModule,
} from '../services/moduleService.js';
import {
    createModuleSchema,
    listModuleQuerySchema,
    moduleIdParamsSchema,
    updateModuleSchema,
} from '../validations/moduleValidation.js';

export const createModuleHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createModuleSchema, req.body);
    const { companyId } = getAuthContext(req);
    const record = await createModule(input, companyId);
    sendSuccess(res, record, undefined, 201);
});

export const listModulesHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listModuleQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listModules(query, companyId);
    sendSuccess(res, items, meta);
});

export const getModuleHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(moduleIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    const record = await getModuleById(id, companyId);
    sendSuccess(res, record);
});

export const updateModuleHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(moduleIdParamsSchema, req.params);
    const input = parseOrThrow(updateModuleSchema, req.body);
    const { companyId } = getAuthContext(req);
    const record = await updateModule(id, input, companyId);
    sendSuccess(res, record);
});

export const deleteModuleHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(moduleIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    await deleteModule(id, companyId);
    res.status(204).send();
});
