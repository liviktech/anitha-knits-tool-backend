import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { checkDatabaseConnection } from '../services/service.js';

export const getLiveness = (req: Request, res: Response): void => {
    res.status(200).json({ status: 'ok', uptimeSeconds: process.uptime() });
};

export const getReadiness = asyncHandler(async (req: Request, res: Response) => {
    const db = await checkDatabaseConnection();
    res.status(200).json({ status: 'ok', db });
});

