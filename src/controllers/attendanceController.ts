import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getAttendanceRecords, upsertDailyAttendance } from '../services/attendanceService.js';
import { parseOrThrow } from '../utils/validate.js';

const bulkAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  records: z.array(
    z.object({
      employeeId: z.string().uuid(),
      status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'COMPANY_HOLIDAY']),
      remarks: z.string().max(500).optional(),
    })
  ),
});

const getAttendanceQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date_from must be YYYY-MM-DD').optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date_to must be YYYY-MM-DD').optional(),
});

export const getAttendance = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { companyId } = req.user!;
    
    const query = parseOrThrow(getAttendanceQuerySchema, req.query);
    
    const dateFrom = query.date_from ? new Date(query.date_from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dateTo = query.date_to ? new Date(query.date_to) : new Date();

    const records = await getAttendanceRecords(companyId, dateFrom, dateTo);

    res.status(200).json({
      success: true,
      data: records,
    });
  }
);

export const bulkUpsertAttendance = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { companyId, sub: userId, role } = req.user!;

    const payload = parseOrThrow(bulkAttendanceSchema, req.body);

    const date = new Date(payload.date);

    const results = await upsertDailyAttendance(companyId, userId, role, date, payload.records);

    res.status(200).json({
      success: true,
      data: results,
      message: 'Attendance recorded successfully',
    });
  }
);
