import { z } from 'zod';

export const dashboardProductionQuerySchema = z
    .object({
        date_from: z.coerce.date().optional(),
        date_to: z.coerce.date().optional(),
    })
    .strict()
    .refine((data) => !data.date_from || !data.date_to || data.date_from <= data.date_to, {
        message: 'date_from must be on or before date_to',
        path: ['date_from'],
    });

export type DashboardProductionQuery = z.infer<typeof dashboardProductionQuerySchema>;

export const dashboardMonthlyQuerySchema = z
    .object({
        month: z.coerce.number().int().min(1).max(12).optional(),
        year: z.coerce.number().int().min(2000).max(2100).optional(),
        type: z.enum(['PRODUCTION', 'SAMPLE']).default('PRODUCTION'),
    })
    .strict();

export type DashboardMonthlyQuery = z.infer<typeof dashboardMonthlyQuerySchema>;
