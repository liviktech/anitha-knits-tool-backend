import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import {
    createEmployee,
    deleteEmployee,
    getEmployeeById,
    listEmployees,
    updateEmployee,
} from '../services/employeeService.js';
import {
    createEmployeeSchema,
    employeeIdParamsSchema,
    listEmployeesQuerySchema,
    updateEmployeeSchema,
} from '../validations/employeeValidation.js';

export const createEmployeeHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createEmployeeSchema, req.body);
    const { companyId } = getAuthContext(req);
    const employee = await createEmployee(input, companyId);
    sendSuccess(res, employee, undefined, 201);
});

export const listEmployeesHandler = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listEmployeesQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const { items, meta } = await listEmployees(query, companyId);
    sendSuccess(res, items, meta);
});

export const getEmployeeHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(employeeIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    const employee = await getEmployeeById(id, companyId);
    sendSuccess(res, employee);
});

export const updateEmployeeHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(employeeIdParamsSchema, req.params);
    const input = parseOrThrow(updateEmployeeSchema, req.body);
    const { companyId } = getAuthContext(req);
    const employee = await updateEmployee(id, input, companyId);
    sendSuccess(res, employee);
});

export const deleteEmployeeHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(employeeIdParamsSchema, req.params);
    const { companyId } = getAuthContext(req);
    await deleteEmployee(id, companyId);
    res.status(204).send();
});
