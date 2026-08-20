import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import { getProductionDashboard } from '../services/dashboardService.js';
import { dashboardProductionQuerySchema } from '../validations/dashboardValidation.js';

export const getProductionDashboardData = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(dashboardProductionQuerySchema, req.query);
    const result = await getProductionDashboard(query);
    sendSuccess(res, result);
});
