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
        fabricWeight: z.coerce.number().min(0).default(0),
        fwWeight: z.coerce.number().min(0).default(0),
        bwWeight: z.coerce.number().min(0).default(0),
    })
    .strict();

export const updateLoadSentSchema = z
    .object({
        date: z.coerce.date(),
        colorId: z.string().uuid(),
        sizeId: z.string().uuid(),
        fabricWeight: z.coerce.number().min(0),
        fwWeight: z.coerce.number().min(0),
        bwWeight: z.coerce.number().min(0),
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
