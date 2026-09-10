import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import { RightAction } from '../types/enums.js';
import { assertModuleActionAllowed } from '../services/roleAccessService.js';
import {
    createExpense,
    deleteExpense,
    getExpenseById,
    listExpenses,
    updateExpense,
} from '../services/expenseService.js';
import {
    createExpenseSchema,
    expenseIdParamsSchema,
    listExpenseQuerySchema,
    updateExpenseSchema,
} from '../validations/expenseValidation.js';

const EXPENSES_MODULE_CODE = 'expenses';

export const createExpenseHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createExpenseSchema, req.body);
    const { companyId, actor, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, EXPENSES_MODULE_CODE, RightAction.ADD);
    const record = await createExpense(input, companyId, actor);
    sendSuccess(res, record, undefined, 201);
});

export const listExpensesHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listExpenseQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listExpenses(query, companyId);
    sendSuccess(res, items, meta);
});

export const getExpenseHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(expenseIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    const record = await getExpenseById(id, companyId);
    sendSuccess(res, record);
});

export const updateExpenseHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(expenseIdParamsSchema, req.params);
    const input = parseOrThrow(updateExpenseSchema, req.body);
    const { companyId, actor, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, EXPENSES_MODULE_CODE, RightAction.EDIT);
    const record = await updateExpense(id, input, companyId, actor);
    sendSuccess(res, record);
});

export const deleteExpenseHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(expenseIdParamsSchema, req.params);
    const { companyId, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, EXPENSES_MODULE_CODE, RightAction.DELETE);
    await deleteExpense(id, companyId);
    res.status(204).send();
});
