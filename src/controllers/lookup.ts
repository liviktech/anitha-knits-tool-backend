import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as lookupService from '../services/lookup.js';

export const getLookups = asyncHandler(async (_req: Request, res: Response) => {
  const result = await lookupService.getLookups();
  res.status(200).json(result);
});
