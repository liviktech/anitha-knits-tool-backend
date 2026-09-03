import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const platformRightIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export const platformRightActionSchema = z.enum(['VIEW', 'ADD', 'EDIT', 'DELETE']);

export const createPlatformRightSchema = z
    .object({
        moduleId: z.string().uuid('moduleId must be a valid UUID'),
        // Omit or pass null for a module-wide right (LK Space's modules today have no Tabs).
        tabId: z.string().uuid('tabId must be a valid UUID').nullable().optional(),
        action: platformRightActionSchema,
    })
    .strict();

export const updatePlatformRightSchema = z
    .object({
        moduleId: z.string().uuid('moduleId must be a valid UUID'),
        tabId: z.string().uuid('tabId must be a valid UUID').nullable(),
        action: platformRightActionSchema,
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listPlatformRightQuerySchema = paginationSchema
    .extend({
        tabId: z.string().uuid().optional(),
        moduleId: z.string().uuid().optional(),
        action: platformRightActionSchema.optional(),
        name: z.string().trim().min(1).optional(),
    })
    .strict();

export type CreatePlatformRightInput = z.infer<typeof createPlatformRightSchema>;
export type UpdatePlatformRightInput = z.infer<typeof updatePlatformRightSchema>;
export type ListPlatformRightQuery = z.infer<typeof listPlatformRightQuerySchema>;
