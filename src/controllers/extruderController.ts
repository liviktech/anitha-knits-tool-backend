import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    approveExtruderProduction,
    createExtruderProduction,
    getExtruderProductionById,
    listExtruderProductions,
    rejectExtruderProduction,
    updateExtruderProduction,
} from '../services/extruderService.js';
import {
    approvalActionSchema,
    createExtruderSchema,
    extruderIdParamsSchema,
    listExtruderQuerySchema,
    updateExtruderSchema,
} from '../validations/extruderValidation.js';

export const createExtruder = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createExtruderSchema, req.body);
    const { companyId, actor } = getAuthContext(req);
    const record = await createExtruderProduction(input, companyId, actor);
    sendSuccess(res, record, undefined, 201);
});

export const listExtruder = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listExtruderQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listExtruderProductions(query, companyId);
    sendSuccess(res, items, meta);
});

export const getExtruder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(extruderIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    const record = await getExtruderProductionById(id, companyId);
    sendSuccess(res, record);
});

export const updateExtruder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(extruderIdParamsSchema, req.params);
    const input = parseOrThrow(updateExtruderSchema, req.body);
    const { companyId, actor } = getAuthContext(req);
    const record = await updateExtruderProduction(id, input, companyId, actor);
    sendSuccess(res, record);
});

export const approveExtruder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(extruderIdParamsSchema, req.params);
    const { reason } = parseOrThrow(approvalActionSchema, req.body ?? {});
    const { companyId, actor } = getAuthContext(req);
    const record = await approveExtruderProduction(id, companyId, actor, reason);
    sendSuccess(res, record);
});

export const rejectExtruder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(extruderIdParamsSchema, req.params);
    const { reason } = parseOrThrow(approvalActionSchema, req.body ?? {});
    const { companyId, actor } = getAuthContext(req);
    const record = await rejectExtruderProduction(id, companyId, actor, reason);
    sendSuccess(res, record);
});
