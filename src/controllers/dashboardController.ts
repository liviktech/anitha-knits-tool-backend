import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { parseOrThrow } from '../utils/validate.js';
import { getMonthlyDashboard, getProductionDashboard } from '../services/dashboardService.js';
import { dashboardMonthlyQuerySchema, dashboardProductionQuerySchema } from '../validations/dashboardValidation.js';

export const getProductionDashboardData = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(dashboardProductionQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const result = await getProductionDashboard(query, companyId);
    sendSuccess(res, result);
});

export const getMonthlyDashboardData = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(dashboardMonthlyQuerySchema, req.query);
    const { companyId } = getAuthContext(req);
    const result = await getMonthlyDashboard(query, companyId);
    sendSuccess(res, result);
});
