import { z } from 'zod';

export const createColorConsumptionStandardSchema = z
    .object({
        colorId: z.string().uuid('colorId must be a valid UUID'),
        gramsPerBasis: z.coerce.number().positive('must be a positive number'),
        basisWeightKg: z.coerce.number().positive('must be a positive number').default(25),
        hdpematerialbag: z.coerce.number().int('must be a whole number').nonnegative('must not be negative').default(1),
        chemicalWeight: z.coerce.number().nonnegative('must not be negative').optional(),
        date: z.coerce.date().optional(),
        isActive: z.boolean().default(true),
    })
    .strict();

export type CreateColorConsumptionStandardInput = z.infer<typeof createColorConsumptionStandardSchema>;
