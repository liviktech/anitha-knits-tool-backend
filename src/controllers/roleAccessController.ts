import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    assignRoleAccessToEmployees,
    createRoleAccess,
    deleteRoleAccess,
    getRoleAccessById,
    listRoleAccesses,
    updateRoleAccess,
} from '../services/roleAccessService.js';
import {
    assignRoleAccessSchema,
    createRoleAccessSchema,
    listRoleAccessQuerySchema,
    roleAccessIdParamsSchema,
    updateRoleAccessSchema,
} from '../validations/roleAccessValidation.js';

export const createRoleAccessHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createRoleAccessSchema, req.body);
    const { companyId } = getAuthContext(req);
    const record = await createRoleAccess(input, companyId);
    sendSuccess(res, record, undefined, 201);
});

export const listRoleAccessesHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listRoleAccessQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listRoleAccesses(query, companyId);
    sendSuccess(res, items, meta);
});

export const getRoleAccessHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(roleAccessIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    const record = await getRoleAccessById(id, companyId);
    sendSuccess(res, record);
});

export const updateRoleAccessHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(roleAccessIdParamsSchema, req.params);
    const input = parseOrThrow(updateRoleAccessSchema, req.body);
    const { companyId } = getAuthContext(req);
    const record = await updateRoleAccess(id, input, companyId);
    sendSuccess(res, record);
});

export const deleteRoleAccessHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(roleAccessIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    await deleteRoleAccess(id, companyId);
    res.status(204).send();
});

export const assignRoleAccessHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(roleAccessIdParamsSchema, req.params);
    const input = parseOrThrow(assignRoleAccessSchema, req.body);
    const { companyId } = getAuthContext(req);
    await assignRoleAccessToEmployees(id, input, companyId);
    sendSuccess(res, { assigned: true });
});
