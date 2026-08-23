import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    createFabricCheckingRecord,
    deleteFabricCheckingRecord,
    getFabricCheckingRecordById,
    listFabricCheckingRecords,
    updateFabricCheckingRecord,
} from '../services/fabricCheckingService.js';
import {
    createFabricCheckingSchema,
    fabricCheckingIdParamsSchema,
    listFabricCheckingQuerySchema,
    updateFabricCheckingSchema,
} from '../validations/fabricCheckingValidation.js';

export const createFabricChecking = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createFabricCheckingSchema, req.body);
    const { companyId, actor } = getAuthContext(req);
    const record = await createFabricCheckingRecord(input, companyId, actor);
    sendSuccess(res, record, undefined, 201);
});

export const listFabricChecking = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listFabricCheckingQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listFabricCheckingRecords(query, companyId);
    sendSuccess(res, items, meta);
});

export const getFabricChecking = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(fabricCheckingIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    const record = await getFabricCheckingRecordById(id, companyId);
    sendSuccess(res, record);
});

export const updateFabricChecking = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(fabricCheckingIdParamsSchema, req.params);
    const input = parseOrThrow(updateFabricCheckingSchema, req.body);
    const { companyId, actor } = getAuthContext(req);
    const record = await updateFabricCheckingRecord(id, input, companyId, actor);
    sendSuccess(res, record);
});

export const deleteFabricChecking = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(fabricCheckingIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    await deleteFabricCheckingRecord(id, companyId);
    res.status(204).send();
});
