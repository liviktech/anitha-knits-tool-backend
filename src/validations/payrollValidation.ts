import { z } from 'zod';

export const distributeMarketValueSchema = z.object({
  marketValueDate: z.string(),
  totalPool: z.number().positive(),
  allocations: z.record(z.string().uuid(), z.number().nonnegative())
});

export const grantSalaryAdvanceSchema = z.object({
  employeeId: z.string().uuid(),
  amount: z.number().positive(),
  effectiveDate: z.string(),
  repaymentMethod: z.enum(['single', 'emi']),
  totalMonths: z.number().int().min(2).max(36).optional(),
}).refine(
  (data) => data.repaymentMethod !== 'emi' || data.totalMonths !== undefined,
  { message: 'totalMonths is required when repaymentMethod is emi', path: ['totalMonths'] }
);

export const getPayrollSummarySchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100)
});

export const savePayrollRecordsSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100)
});
