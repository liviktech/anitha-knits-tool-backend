import { z } from 'zod';
import { ProductionStatus } from '@prisma/client';
import { paginationSchema } from '../utils/pagination.js';

export const extruderIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

const kg = z.coerce.number().positive('must be a positive number');

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
        status: z.nativeEnum(ProductionStatus).optional(),
    })
    .strict();

export const approvalActionSchema = z
    .object({
        reason: z.string().trim().max(500).optional(),
    })
    .strict();

export type CreateExtruderInput = z.infer<typeof createExtruderSchema>;
export type UpdateExtruderInput = z.infer<typeof updateExtruderSchema>;
export type ListExtruderQuery = z.infer<typeof listExtruderQuerySchema>;
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;
