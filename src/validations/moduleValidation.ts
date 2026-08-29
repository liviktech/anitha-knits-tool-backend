import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const moduleIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export const createModuleSchema = z
    .object({
        moduleCode: z.string().trim().min(1).max(50),
        moduleName: z.string().trim().min(1).max(100),
    })
    .strict();

export const updateModuleSchema = z
    .object({
        moduleCode: z.string().trim().min(1).max(50),
        moduleName: z.string().trim().min(1).max(100),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listModuleQuerySchema = paginationSchema
    .extend({
        name: z.string().trim().min(1).optional(),
    })
    .strict();

export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type ListModuleQuery = z.infer<typeof listModuleQuerySchema>;
