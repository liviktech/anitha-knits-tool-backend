import { z } from 'zod';

const requiredKg = z.coerce.number().positive('must be a positive number');
const optionalKg = z.coerce.number().nonnegative('must not be negative').optional();

export const createColorConsumptionStandardSchema = z
    .object({
        date: z.coerce.date().optional(),
        basisWeightKg: z.coerce.number().positive('must be a positive number').default(25),
        hdpematerialbag: z.coerce.number().int('must be a whole number').nonnegative('must not be negative').default(1),
        whiteKgBasis: requiredKg,
        blueKgBasis: requiredKg,
        greenKgBasis: requiredKg,
        chemicalWeight: optionalKg,
        isActive: z.boolean().default(true),
    })
    .strict();

export const updateColorConsumptionStandardSchema = z
    .object({
        date: z.coerce.date().optional(),
        basisWeightKg: z.coerce.number().positive('must be a positive number').optional(),
        hdpematerialbag: z.coerce.number().int('must be a whole number').nonnegative('must not be negative').optional(),
        whiteKgBasis: requiredKg.optional(),
        blueKgBasis: requiredKg.optional(),
        greenKgBasis: requiredKg.optional(),
        chemicalWeight: optionalKg,
        isActive: z.boolean().optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const colorConsumptionStandardIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export type CreateColorConsumptionStandardInput = z.infer<typeof createColorConsumptionStandardSchema>;
export type UpdateColorConsumptionStandardInput = z.infer<typeof updateColorConsumptionStandardSchema>;
