import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getAuthContext } from '../utils/actor.js';
import * as lookupService from '../services/lookup.js';

export const getLookups = asyncHandler(async (req: Request, res: Response) => {
  const { companyId } = getAuthContext(req);
  const result = await lookupService.getLookups(companyId);
  res.status(200).json(result);
});
