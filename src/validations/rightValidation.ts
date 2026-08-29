import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const rightIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

const rightNameField = z
    .string()
    .trim()
    .min(1)
    .max(100)
    .transform((value) => value.replace(/\s+/g, '_').toLowerCase());

export const createRightSchema = z
    .object({
        moduleId: z.string().uuid('moduleId must be a valid UUID'),
        // Omit or pass null for a module-wide right (most modules have no Tabs).
        tabId: z.string().uuid('tabId must be a valid UUID').nullable().optional(),
        rightName: rightNameField,
        displayName: z.string().trim().min(1).max(150),
    })
    .strict();

export const updateRightSchema = z
    .object({
        moduleId: z.string().uuid('moduleId must be a valid UUID'),
        tabId: z.string().uuid('tabId must be a valid UUID').nullable(),
        rightName: rightNameField,
        displayName: z.string().trim().min(1).max(150),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listRightQuerySchema = paginationSchema
    .extend({
        tabId: z.string().uuid().optional(),
        moduleId: z.string().uuid().optional(),
        name: z.string().trim().min(1).optional(),
    })
    .strict();

export type CreateRightInput = z.infer<typeof createRightSchema>;
export type UpdateRightInput = z.infer<typeof updateRightSchema>;
export type ListRightQuery = z.infer<typeof listRightQuerySchema>;
