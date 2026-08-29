import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import { distributeMarketValueSchema, grantSalaryAdvanceSchema, getPayrollSummarySchema, savePayrollRecordsSchema } from '../validations/payrollValidation.js';
import { distributeMarketValue, grantSalaryAdvance, getPayrollSummary, savePayrollRecords, getSavedPayrollRecords, getMarketValueAllocations, getSalaryAdvances } from '../services/payrollService.js';

export const distributeMarketValueHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(distributeMarketValueSchema, req.body);
    const { companyId, userId } = getAuthContext(req);
    
    const result = await distributeMarketValue(companyId, userId, input);
    sendSuccess(res, result, { message: 'Market value distributed successfully' }, 201);
});

export const grantSalaryAdvanceHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(grantSalaryAdvanceSchema, req.body);
    const { companyId, userId } = getAuthContext(req);
    
    const result = await grantSalaryAdvance(companyId, userId, input);
    sendSuccess(res, result, { message: 'Salary advance granted successfully' }, 201);
});

export const getPayrollSummaryHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(getPayrollSummarySchema, req.query);
    const { companyId } = getAuthContext(req);

    const result = await getPayrollSummary(companyId, input.month, input.year);
    sendSuccess(res, result, { message: 'Payroll summary fetched successfully' }, 200);
});

export const getSalaryAdvancesHandler = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = getAuthContext(req);

    const result = await getSalaryAdvances(companyId);
    sendSuccess(res, result, { message: 'Salary advances fetched successfully' }, 200);
});

export const savePayrollRecordsHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(savePayrollRecordsSchema, req.body);
    const { companyId } = getAuthContext(req);
    
    const result = await savePayrollRecords(companyId, input);
    sendSuccess(res, result, { message: 'Payroll records saved successfully' }, 201);
});

export const getSavedPayrollRecordsHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(getPayrollSummarySchema, req.query);
    const { companyId } = getAuthContext(req);
    
    const result = await getSavedPayrollRecords(companyId, input.month, input.year);
    sendSuccess(res, result, { message: 'Saved payroll records fetched successfully' }, 200);
});

export const getMarketValueAllocationsHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(getPayrollSummarySchema, req.query);
    const { companyId } = getAuthContext(req);
    
    const result = await getMarketValueAllocations(companyId, input.month, input.year);
    sendSuccess(res, result, { message: 'Market value allocations fetched successfully' }, 200);
});
