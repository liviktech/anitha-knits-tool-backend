import { z } from 'zod';
import { ProductionStatus } from '@prisma/client';

export const dashboardProductionQuerySchema = z
    .object({
        date_from: z.coerce.date().optional(),
        date_to: z.coerce.date().optional(),
        status: z.nativeEnum(ProductionStatus).optional(),
    })
    .strict()
    .refine((data) => !data.date_from || !data.date_to || data.date_from <= data.date_to, {
        message: 'date_from must be on or before date_to',
        path: ['date_from'],
    });

export type DashboardProductionQuery = z.infer<typeof dashboardProductionQuerySchema>;
