import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import { listLivikEmployees } from '../services/livikEmployeeService.js';
import { listLivikEmployeesQuerySchema } from '../validations/livikEmployeeValidation.js';

export const listLivikEmployeesHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listLivikEmployeesQuerySchema, req.query);
    const { items, meta } = await listLivikEmployees(query);
    sendSuccess(res, items, meta);
});
