import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import { createManagedUser, deleteUser, getUserById, listUsers, updateUser } from '../services/userService.js';
import {
    createUserSchema,
    listUsersQuerySchema,
    updateUserSchema,
    userIdParamsSchema,
} from '../validations/userValidation.js';

export const createUserHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createUserSchema, req.body);
    const { companyId } = getAuthContext(req);
    const user = await createManagedUser(input, companyId);
    sendSuccess(res, user, undefined, 201);
});

export const listUsersHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listUsersQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listUsers(query, companyId);
    sendSuccess(res, items, meta);
});

export const getUserHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(userIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    const user = await getUserById(id, companyId);
    sendSuccess(res, user);
});

export const updateUserHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(userIdParamsSchema, req.params);
    const input = parseOrThrow(updateUserSchema, req.body);
    const { companyId, userId } = getAuthContext(req);
    const user = await updateUser(id, input, companyId, userId);
    sendSuccess(res, user);
});

export const deleteUserHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(userIdParamsSchema, req.params);
    const { companyId, userId } = getAuthContext(req);
    await deleteUser(id, companyId, userId);
    res.status(204).send();
});
