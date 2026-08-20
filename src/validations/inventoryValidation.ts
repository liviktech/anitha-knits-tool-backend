import { z } from 'zod';
import { InventoryType } from '@prisma/client';
import { paginationSchema } from '../utils/pagination.js';

export const inventoryIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export const createInventorySchema = z
    .object({
        date: z.coerce.date().optional(),
        type: z.nativeEnum(InventoryType),
        name: z.string().trim().min(1).max(150),
        weightKg: z.coerce.number().positive('must be a positive number'),
    })
    .strict();

export const updateInventorySchema = z
    .object({
        date: z.coerce.date(),
        type: z.nativeEnum(InventoryType),
        name: z.string().trim().min(1).max(150),
        weightKg: z.coerce.number().positive('must be a positive number'),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listInventoryQuerySchema = paginationSchema
    .extend({
        date_from: z.coerce.date().optional(),
        date_to: z.coerce.date().optional(),
        type: z.nativeEnum(InventoryType).optional(),
        name: z.string().trim().min(1).optional(),
    })
    .strict();

export type CreateInventoryInput = z.infer<typeof createInventorySchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;
