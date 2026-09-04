import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parseOrThrow } from '../utils/validate.js';
import { getAuthContext } from '../utils/actor.js';
import { listKoraBalances, getKoraLedger, getKoraBalanceExcludingRecord } from '../services/koraBalanceService.js';
import {
    koraBalanceExcludingRecordParamsSchema,
    koraLedgerParamsSchema,
    listKoraLedgerQuerySchema,
} from '../validations/koraBalanceValidation.js';

export const listBalances = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = getAuthContext(req);
    const balances = await listKoraBalances(companyId);
    sendSuccess(res, balances);
});

export const getLedger = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = getAuthContext(req);
    const { colorId, sizeId } = parseOrThrow(koraLedgerParamsSchema, req.params);
    const query = parseOrThrow(listKoraLedgerQuerySchema, req.query);
    const result = await getKoraLedger(companyId, colorId, sizeId, query);
    sendSuccess(res, result.items, { ...result.meta, balance: result.balance });
});

export const getBalanceExcludingRecord = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = getAuthContext(req);
    const { colorId, sizeId, recordId } = parseOrThrow(koraBalanceExcludingRecordParamsSchema, req.params);
    const balanceKg = await getKoraBalanceExcludingRecord(companyId, colorId, sizeId, recordId);
    sendSuccess(res, { colorId, sizeId, balanceKg });
});
