import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import { RightAction } from '../types/enums.js';
import { assertModuleActionAllowed } from '../services/roleAccessService.js';
import { distributeMarketValueSchema, grantSalaryAdvanceSchema, updateSalaryAdvanceSchema, salaryAdvanceIdParamsSchema, grantMarketValueDeductionSchema, grantOtherDeductionSchema, getPayrollSummarySchema, savePayrollRecordsSchema, updatePayrollRecordSchema, payrollRecordEmployeeIdParamsSchema, deletePayrollRecordQuerySchema } from '../validations/payrollValidation.js';
import { distributeMarketValue, grantSalaryAdvance, updateSalaryAdvance, deleteSalaryAdvance, grantMarketValueDeduction, grantOtherDeduction, getPayrollSummary, savePayrollRecords, updatePayrollRecord, deletePayrollRecord, getSavedPayrollRecords, getMarketValueAllocations, getSalaryAdvances } from '../services/payrollService.js';

const PAYROLL_MODULE_CODE = 'employees';
const PAYROLL_TAB_CODE = 'payroll';

export const distributeMarketValueHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(distributeMarketValueSchema, req.body);
    const { companyId, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, PAYROLL_MODULE_CODE, RightAction.EDIT, PAYROLL_TAB_CODE);

    const result = await distributeMarketValue(companyId, userId, input);
    sendSuccess(res, result, { message: 'Market value distributed successfully' }, 201);
});

export const grantSalaryAdvanceHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(grantSalaryAdvanceSchema, req.body);
    const { companyId, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, PAYROLL_MODULE_CODE, RightAction.ADD, PAYROLL_TAB_CODE);

    const result = await grantSalaryAdvance(companyId, userId, input);
    sendSuccess(res, result, { message: 'Salary advance granted successfully' }, 201);
});

export const grantMarketValueDeductionHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(grantMarketValueDeductionSchema, req.body);
    const { companyId, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, PAYROLL_MODULE_CODE, RightAction.EDIT, PAYROLL_TAB_CODE);

    const result = await grantMarketValueDeduction(companyId, userId, input);
    sendSuccess(res, result, { message: 'Market value deduction granted successfully' }, 201);
});

export const grantOtherDeductionHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(grantOtherDeductionSchema, req.body);
    const { companyId, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, PAYROLL_MODULE_CODE, RightAction.EDIT, PAYROLL_TAB_CODE);

    const result = await grantOtherDeduction(companyId, userId, input);
    sendSuccess(res, result, { message: 'Other deduction granted successfully' }, 201);
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

export const updateSalaryAdvanceHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(updateSalaryAdvanceSchema, req.body);
    const { id } = parseOrThrow(salaryAdvanceIdParamsSchema, req.params);
    const { companyId, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, PAYROLL_MODULE_CODE, RightAction.EDIT, PAYROLL_TAB_CODE);

    const result = await updateSalaryAdvance(companyId, userId, id, input);
    sendSuccess(res, result, { message: 'Salary advance updated successfully' }, 200);
});

export const deleteSalaryAdvanceHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(salaryAdvanceIdParamsSchema, req.params);
    const { companyId, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, PAYROLL_MODULE_CODE, RightAction.DELETE, PAYROLL_TAB_CODE);

    const result = await deleteSalaryAdvance(companyId, id);
    sendSuccess(res, result, { message: 'Salary advance deleted successfully' }, 200);
});

export const savePayrollRecordsHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(savePayrollRecordsSchema, req.body);
    const { companyId, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, PAYROLL_MODULE_CODE, RightAction.ADD, PAYROLL_TAB_CODE);

    const result = await savePayrollRecords(companyId, input);
    sendSuccess(res, result, { message: 'Payroll records saved successfully' }, 201);
});

export const updatePayrollRecordHandler = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(updatePayrollRecordSchema, req.body);
    const { employeeId } = parseOrThrow(payrollRecordEmployeeIdParamsSchema, req.params);
    const { companyId, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, PAYROLL_MODULE_CODE, RightAction.EDIT, PAYROLL_TAB_CODE);

    const result = await updatePayrollRecord(companyId, { employeeId, ...input });
    sendSuccess(res, result, { message: 'Payroll record updated successfully' }, 200);
});

export const deletePayrollRecordHandler = asyncHandler(async (req: Request, res: Response) => {
    const { employeeId } = parseOrThrow(payrollRecordEmployeeIdParamsSchema, req.params);
    const { month, year } = parseOrThrow(deletePayrollRecordQuerySchema, req.query);
    const { companyId, userId, role } = getAuthContext(req);
    await assertModuleActionAllowed(role, userId, companyId, PAYROLL_MODULE_CODE, RightAction.DELETE, PAYROLL_TAB_CODE);

    const result = await deletePayrollRecord(companyId, employeeId, month, year);
    sendSuccess(res, result, { message: 'Payroll record deleted successfully' }, 200);
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
