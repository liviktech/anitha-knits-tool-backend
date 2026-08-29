import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const tabIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export const createTabSchema = z
    .object({
        moduleId: z.string().uuid('moduleId must be a valid UUID'),
        tabCode: z.string().trim().min(1).max(50),
        tabName: z.string().trim().min(1).max(100),
    })
    .strict();

export const updateTabSchema = z
    .object({
        moduleId: z.string().uuid('moduleId must be a valid UUID'),
        tabCode: z.string().trim().min(1).max(50),
        tabName: z.string().trim().min(1).max(100),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listTabQuerySchema = paginationSchema
    .extend({
        moduleId: z.string().uuid().optional(),
        name: z.string().trim().min(1).optional(),
    })
    .strict();

export type CreateTabInput = z.infer<typeof createTabSchema>;
export type UpdateTabInput = z.infer<typeof updateTabSchema>;
export type ListTabQuery = z.infer<typeof listTabQuerySchema>;
