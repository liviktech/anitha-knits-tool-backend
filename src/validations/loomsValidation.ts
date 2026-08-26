import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const loomsIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

const kg = z.coerce.number().positive('must be a positive number');
const wastageKg = z.coerce.number().nonnegative('must not be negative').optional();

export const createLoomsSchema = z
    .object({
        productionDate: z.coerce.date(),
        colorId: z.string().uuid(),
        sizeId: z.string().uuid(),
        yarnInputKg: kg,
        fabricOutputKg: kg,
        type: z.enum(['PRODUCTION', 'SAMPLE']).default('PRODUCTION'),
        remarks: z.string().trim().max(500).optional(),
        // Wastage entered alongside this production record (PRD §9): optional,
        // and only turns into a WastageRecord when > 0 — see wastageService.ts.
        loomsWasteKg: wastageKg,
    })
    .strict();

export const updateLoomsSchema = z
    .object({
        productionDate: z.coerce.date(),
        colorId: z.string().uuid(),
        sizeId: z.string().uuid(),
        yarnInputKg: kg,
        fabricOutputKg: kg,
        remarks: z.string().trim().max(500).optional(),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listLoomsQuerySchema = paginationSchema
    .extend({
        date_from: z.coerce.date().optional(),
        date_to: z.coerce.date().optional(),
        color_id: z.string().uuid().optional(),
        size: z.string().uuid().optional(),
    })
    .strict();

export type CreateLoomsInput = z.infer<typeof createLoomsSchema>;
export type UpdateLoomsInput = z.infer<typeof updateLoomsSchema>;
export type ListLoomsQuery = z.infer<typeof listLoomsQuerySchema>;
