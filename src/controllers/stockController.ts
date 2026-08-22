import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAuthContext } from '../utils/actor.js';
import { getInventoryStockSummary } from '../services/stockService.js';

export const getInventoryStockHandler = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = getAuthContext(req);
    const summary = await getInventoryStockSummary(companyId);
    sendSuccess(res, summary);
});
