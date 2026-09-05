import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const openingBalanceFabricStockIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export const createOpeningBalanceFabricStockSchema = z
    .object({
        date: z.coerce.date(),
        colorId: z.string().uuid().optional(),
        sizeId: z.string().uuid().optional(),
        chemicalId: z.string().uuid().optional(),
        koraBalanceKg: z.coerce.number().nonnegative('must not be negative').default(0),
        fabricStockKg: z.coerce.number().nonnegative('must not be negative').default(0),
    })
    .strict();

export const batchCreateOpeningBalanceFabricStockSchema = z
    .object({
        items: z.array(createOpeningBalanceFabricStockSchema).min(1, 'At least one item is required'),
    })
    .strict();

export const updateOpeningBalanceFabricStockSchema = z
    .object({
        date: z.coerce.date(),
        colorId: z.string().uuid().nullable(),
        sizeId: z.string().uuid().nullable(),
        chemicalId: z.string().uuid().nullable(),
        koraBalanceKg: z.coerce.number().nonnegative('must not be negative'),
        fabricStockKg: z.coerce.number().nonnegative('must not be negative'),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listOpeningBalanceFabricStockQuerySchema = paginationSchema
    .extend({
        date_from: z.coerce.date().optional(),
        date_to: z.coerce.date().optional(),
        color_id: z.string().uuid().optional(),
        size_id: z.string().uuid().optional(),
    })
    .strict();

export type CreateOpeningBalanceFabricStockInput = z.infer<typeof createOpeningBalanceFabricStockSchema>;
export type BatchCreateOpeningBalanceFabricStockInput = z.infer<typeof batchCreateOpeningBalanceFabricStockSchema>;
export type UpdateOpeningBalanceFabricStockInput = z.infer<typeof updateOpeningBalanceFabricStockSchema>;
export type ListOpeningBalanceFabricStockQuery = z.infer<typeof listOpeningBalanceFabricStockQuerySchema>;
