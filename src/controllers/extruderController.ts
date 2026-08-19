import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getActor } from '../utils/actor.js';
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
    const record = await createExtruderProduction(input, getActor(req));
    sendSuccess(res, record, undefined, 201);
});

export const listExtruder = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listExtruderQuerySchema, req.query);
    const { items, meta } = await listExtruderProductions(query);
    sendSuccess(res, items, meta);
});

export const getExtruder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(extruderIdParamsSchema, req.params);
    const record = await getExtruderProductionById(id);
    sendSuccess(res, record);
});

export const updateExtruder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(extruderIdParamsSchema, req.params);
    const input = parseOrThrow(updateExtruderSchema, req.body);
    const record = await updateExtruderProduction(id, input, getActor(req));
    sendSuccess(res, record);
});

export const approveExtruder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(extruderIdParamsSchema, req.params);
    const { reason } = parseOrThrow(approvalActionSchema, req.body ?? {});
    const record = await approveExtruderProduction(id, getActor(req), reason);
    sendSuccess(res, record);
});

export const rejectExtruder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(extruderIdParamsSchema, req.params);
    const { reason } = parseOrThrow(approvalActionSchema, req.body ?? {});
    const record = await rejectExtruderProduction(id, getActor(req), reason);
    sendSuccess(res, record);
});
