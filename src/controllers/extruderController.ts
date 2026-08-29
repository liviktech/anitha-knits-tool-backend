import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import { UnauthorizedError } from '../utils/errors.js';
import {
    approveExtruderProduction,
    createExtruderProduction,
    deleteExtruderProduction,
    getExtruderProductionById,
    listExtruderProductions,
    updateExtruderProduction,
} from '../services/extruderService.js';
import {
    createExtruderSchema,
    extruderIdParamsSchema,
    listExtruderQuerySchema,
    updateExtruderSchema,
} from '../validations/extruderValidation.js';

/** requireAuth() already guarantees req.user is set — this just narrows the type past that. */
function requireRole(req: Request) {
    if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
    return req.user.role;
}

export const createExtruder = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createExtruderSchema, req.body);
    const { companyId, actor, userId } = getAuthContext(req);
    const record = await createExtruderProduction(input, companyId, actor, requireRole(req), userId);
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
    const { companyId, actor, userId } = getAuthContext(req);
    const record = await updateExtruderProduction(id, input, companyId, actor, requireRole(req), userId);
    sendSuccess(res, record);
});

export const deleteExtruder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(extruderIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    await deleteExtruderProduction(id, companyId, requireRole(req));
    res.status(204).send();
});

export const approveExtruder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(extruderIdParamsSchema, req.params);
    const { companyId, actor } = getAuthContext(req);
    const record = await approveExtruderProduction(id, companyId, actor);
    sendSuccess(res, record);
});
