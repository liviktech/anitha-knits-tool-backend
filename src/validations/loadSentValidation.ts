import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const loadSentIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export const createLoadSentSchema = z
    .object({
        date: z.coerce.date().optional(),
        colorId: z.string().uuid(),
        sizeId: z.string().uuid(),
        pieceCount: z.coerce.number().int().positive('must be a positive integer'),
        weightKg: z.coerce.number().positive('must be a positive number'),
    })
    .strict();

export const updateLoadSentSchema = z
    .object({
        date: z.coerce.date(),
        colorId: z.string().uuid(),
        sizeId: z.string().uuid(),
        pieceCount: z.coerce.number().int().positive('must be a positive integer'),
        weightKg: z.coerce.number().positive('must be a positive number'),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listLoadSentQuerySchema = paginationSchema
    .extend({
        date_from: z.coerce.date().optional(),
        date_to: z.coerce.date().optional(),
        color_id: z.string().uuid().optional(),
        size_id: z.string().uuid().optional(),
    })
    .strict();

export type CreateLoadSentInput = z.infer<typeof createLoadSentSchema>;
export type UpdateLoadSentInput = z.infer<typeof updateLoadSentSchema>;
export type ListLoadSentQuery = z.infer<typeof listLoadSentQuerySchema>;
