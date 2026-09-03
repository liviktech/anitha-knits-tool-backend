import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const platformTabIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export const createPlatformTabSchema = z
    .object({
        moduleId: z.string().uuid('moduleId must be a valid UUID'),
        tabCode: z.string().trim().min(1).max(50),
        tabName: z.string().trim().min(1).max(100),
    })
    .strict();

export const updatePlatformTabSchema = z
    .object({
        moduleId: z.string().uuid('moduleId must be a valid UUID'),
        tabCode: z.string().trim().min(1).max(50),
        tabName: z.string().trim().min(1).max(100),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listPlatformTabQuerySchema = paginationSchema
    .extend({
        moduleId: z.string().uuid().optional(),
        name: z.string().trim().min(1).optional(),
    })
    .strict();

export type CreatePlatformTabInput = z.infer<typeof createPlatformTabSchema>;
export type UpdatePlatformTabInput = z.infer<typeof updatePlatformTabSchema>;
export type ListPlatformTabQuery = z.infer<typeof listPlatformTabQuerySchema>;
