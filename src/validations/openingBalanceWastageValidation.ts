import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const openingBalanceWastageIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

const wastageKg = z.coerce.number().nonnegative('must not be negative').default(0);

export const createOpeningBalanceWastageSchema = z
    .object({
        date: z.coerce.date(),
        colorId: z.string().uuid().optional(),
        sizeId: z.string().uuid().optional(),
        chemicalId: z.string().uuid().optional(),
        extruderLumpsKg: wastageKg,
        extruderLoomsWasteKg: wastageKg,
        loomsYarnWasteKg: wastageKg,
        fabricWasteKg: wastageKg,
        fabricBitwasteKg: wastageKg,
    })
    .strict();

export const batchCreateOpeningBalanceWastageSchema = z
    .object({
        items: z.array(createOpeningBalanceWastageSchema).min(1, 'At least one item is required'),
    })
    .strict();

export const updateOpeningBalanceWastageSchema = z
    .object({
        date: z.coerce.date(),
        colorId: z.string().uuid().nullable(),
        sizeId: z.string().uuid().nullable(),
        chemicalId: z.string().uuid().nullable(),
        extruderLumpsKg: z.coerce.number().nonnegative('must not be negative'),
        extruderLoomsWasteKg: z.coerce.number().nonnegative('must not be negative'),
        loomsYarnWasteKg: z.coerce.number().nonnegative('must not be negative'),
        fabricWasteKg: z.coerce.number().nonnegative('must not be negative'),
        fabricBitwasteKg: z.coerce.number().nonnegative('must not be negative'),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listOpeningBalanceWastageQuerySchema = paginationSchema
    .extend({
        date_from: z.coerce.date().optional(),
        date_to: z.coerce.date().optional(),
        color_id: z.string().uuid().optional(),
        size_id: z.string().uuid().optional(),
    })
    .strict();

export type CreateOpeningBalanceWastageInput = z.infer<typeof createOpeningBalanceWastageSchema>;
export type BatchCreateOpeningBalanceWastageInput = z.infer<typeof batchCreateOpeningBalanceWastageSchema>;
export type UpdateOpeningBalanceWastageInput = z.infer<typeof updateOpeningBalanceWastageSchema>;
export type ListOpeningBalanceWastageQuery = z.infer<typeof listOpeningBalanceWastageQuerySchema>;
