import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const platformModuleIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export const createPlatformModuleSchema = z
    .object({
        moduleCode: z.string().trim().min(1).max(50),
        moduleName: z.string().trim().min(1).max(100),
    })
    .strict();

export const updatePlatformModuleSchema = z
    .object({
        moduleCode: z.string().trim().min(1).max(50),
        moduleName: z.string().trim().min(1).max(100),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listPlatformModuleQuerySchema = paginationSchema
    .extend({
        name: z.string().trim().min(1).optional(),
    })
    .strict();

export type CreatePlatformModuleInput = z.infer<typeof createPlatformModuleSchema>;
export type UpdatePlatformModuleInput = z.infer<typeof updatePlatformModuleSchema>;
export type ListPlatformModuleQuery = z.infer<typeof listPlatformModuleQuerySchema>;
