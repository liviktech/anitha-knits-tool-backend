import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    assignPlatformRoleToEmployees,
    createPlatformRoleAccess,
    deletePlatformRoleAccess,
    getPlatformRoleAccessById,
    listPlatformEmployeeAccess,
    listPlatformRoleAccesses,
    updatePlatformRoleAccess,
} from '../services/platformRoleAccessService.js';
import {
    assignPlatformRoleAccessSchema,
    createPlatformRoleAccessSchema,
    listPlatformRoleAccessQuerySchema,
    platformRoleAccessIdParamsSchema,
    updatePlatformRoleAccessSchema,
} from '../validations/platformRoleAccessValidation.js';

export const createPlatformRoleAccessHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createPlatformRoleAccessSchema, req.body);
    const record = await createPlatformRoleAccess(input);
    sendSuccess(res, record, undefined, 201);
});

export const listPlatformRoleAccessesHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listPlatformRoleAccessQuerySchema, req.query);
    const { items, meta } = await listPlatformRoleAccesses(query);
    sendSuccess(res, items, meta);
});

export const getPlatformRoleAccessHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(platformRoleAccessIdParamsSchema, req.params);
    const record = await getPlatformRoleAccessById(id);
    sendSuccess(res, record);
});

export const updatePlatformRoleAccessHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(platformRoleAccessIdParamsSchema, req.params);
    const input = parseOrThrow(updatePlatformRoleAccessSchema, req.body);
    const record = await updatePlatformRoleAccess(id, input);
    sendSuccess(res, record);
});

export const deletePlatformRoleAccessHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(platformRoleAccessIdParamsSchema, req.params);
    await deletePlatformRoleAccess(id);
    res.status(204).send();
});

export const assignPlatformRoleAccessHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(platformRoleAccessIdParamsSchema, req.params);
    const input = parseOrThrow(assignPlatformRoleAccessSchema, req.body);
    await assignPlatformRoleToEmployees(id, input);
    sendSuccess(res, { assigned: true });
});

export const listPlatformEmployeeAccessHandler = asyncHandler(async (_req: Request, res: Response) => {
    const items = await listPlatformEmployeeAccess();
    sendSuccess(res, items);
});
