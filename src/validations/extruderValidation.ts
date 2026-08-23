import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const extruderIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

const kg = z.coerce.number().positive('must be a positive number');
const wastageKg = z.coerce.number().nonnegative('must not be negative').optional();

export const createExtruderSchema = z
    .object({
        productionDate: z.coerce.date(),
        colorId: z.string().uuid(),
        sizeId: z.string().uuid(),
        brandId: z.string().uuid(),
        chemicalId: z.string().uuid(),
        rawMaterialKg: kg,
        chemicalKg: kg,
        colorConsumedKg: kg.optional(),
        yarnOutputKg: kg,
        remarks: z.string().trim().max(500).optional(),
        overrideReason: z.string().trim().min(1).max(500).optional(),
        // Wastage entered alongside this production record (PRD §9): optional,
        // and only turns into a WastageRecord when > 0 — see wastageService.ts.
        yarnWasteKg: wastageKg,
        lumpsKg: wastageKg,
    })
    .strict();

export const updateExtruderSchema = z
    .object({
        productionDate: z.coerce.date(),
        colorId: z.string().uuid(),
        sizeId: z.string().uuid(),
        brandId: z.string().uuid(),
        chemicalId: z.string().uuid(),
        rawMaterialKg: kg,
        chemicalKg: kg,
        colorConsumedKg: kg,
        yarnOutputKg: kg,
        remarks: z.string().trim().max(500).optional(),
        overrideReason: z.string().trim().min(1).max(500).optional(),
        // Wastage on an existing record (PRD §9): omit to leave untouched,
        // 0 to clear it, or a positive number to set/replace it — see
        // wastageService.applyWastageUpdates.
        yarnWasteKg: wastageKg,
        lumpsKg: wastageKg,
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listExtruderQuerySchema = paginationSchema
    .extend({
        date_from: z.coerce.date().optional(),
        date_to: z.coerce.date().optional(),
        color_id: z.string().uuid().optional(),
        size: z.string().uuid().optional(),
    })
    .strict();

export type CreateExtruderInput = z.infer<typeof createExtruderSchema>;
export type UpdateExtruderInput = z.infer<typeof updateExtruderSchema>;
export type ListExtruderQuery = z.infer<typeof listExtruderQuerySchema>;
