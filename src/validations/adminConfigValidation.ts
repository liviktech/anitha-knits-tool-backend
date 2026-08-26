import { z } from 'zod';

const grams = z.coerce.number().positive('must be a positive number');

export const createColorConsumptionStandardSchema = z
    .object({
        date: z.coerce.date().optional(),
        basisWeightKg: z.coerce.number().positive('must be a positive number').default(25),
        hdpematerialbag: z.coerce.number().int('must be a whole number').nonnegative('must not be negative').default(1),
        whiteGramsPerBasis: grams,
        blueGramsPerBasis: grams,
        greenGramsPerBasis: grams,
        chemicalWeight: z.coerce.number().nonnegative('must not be negative').optional(),
        isActive: z.boolean().default(true),
    })
    .strict();

export type CreateColorConsumptionStandardInput = z.infer<typeof createColorConsumptionStandardSchema>;
