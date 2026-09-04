import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import { UnauthorizedError } from '../utils/errors.js';
import {
    approveFabricCheckingRecord,
    createFabricCheckingRecord,
    deleteFabricCheckingRecord,
    getAvailableFabricStockKg,
    getFabricCheckingRecordById,
    listFabricCheckingRecords,
    updateFabricCheckingRecord,
} from '../services/fabricCheckingService.js';
import {
    availableFabricQuerySchema,
    createFabricCheckingSchema,
    fabricCheckingIdParamsSchema,
    listFabricCheckingQuerySchema,
    updateFabricCheckingSchema,
} from '../validations/fabricCheckingValidation.js';

/** requireAuth() already guarantees req.user is set — this just narrows the type past that. */
function requireRole(req: Request) {
    if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
    return req.user.role;
}

export const createFabricChecking = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createFabricCheckingSchema, req.body);
    const { companyId, actor, userId } = getAuthContext(req);
    const record = await createFabricCheckingRecord(input, companyId, actor, requireRole(req), userId);
    sendSuccess(res, record, undefined, 201);
});

export const getAvailableFabric = asyncHandler(async (req: Request, res: Response) => {
    const { colorId, sizeId, chemicalId, date } = parseOrThrow(availableFabricQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const availableKg = await getAvailableFabricStockKg(companyId, colorId, sizeId, chemicalId, date);
    sendSuccess(res, { colorId, sizeId, chemicalId, availableKg });
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
    const { companyId, actor, userId } = getAuthContext(req);
    const record = await updateFabricCheckingRecord(id, input, companyId, actor, requireRole(req), userId);
    sendSuccess(res, record);
});

export const deleteFabricChecking = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(fabricCheckingIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    await deleteFabricCheckingRecord(id, companyId, requireRole(req));
    res.status(204).send();
});

export const approveFabricChecking = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(fabricCheckingIdParamsSchema, req.params);
    const { companyId, actor } = getAuthContext(req);
    const record = await approveFabricCheckingRecord(id, companyId, actor);
    sendSuccess(res, record);
});
