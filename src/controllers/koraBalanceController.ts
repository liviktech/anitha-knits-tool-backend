import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import { listKoraBalances, getKoraLedger } from '../services/koraBalanceService.js';
import {
    koraLedgerParamsSchema,
    listKoraLedgerQuerySchema,
} from '../validations/koraBalanceValidation.js';

export const listBalances = asyncHandler(async (_req: Request, res: Response) => {
    const balances = await listKoraBalances();
    sendSuccess(res, balances);
});

export const getLedger = asyncHandler(async (req: Request, res: Response) => {
    const { colorId, sizeId } = parseOrThrow(koraLedgerParamsSchema, req.params);
    const query = parseOrThrow(listKoraLedgerQuerySchema, req.query);
    const result = await getKoraLedger(colorId, sizeId, query);
    sendSuccess(res, result.items, { ...result.meta, balance: result.balance });
});
