import { z } from 'zod';
import { InventoryType } from '@prisma/client';
import { paginationSchema } from '../utils/pagination.js';

export const inventoryIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

/** Requires exactly the id field matching `type`: brandId for HDPE, chemicalId for CHEMICAL, colorId for COLOR. */
function requireMatchingItemId(data: { type: InventoryType; brandId?: string; chemicalId?: string; colorId?: string }, ctx: z.RefinementCtx) {
    const fieldByType: Record<InventoryType, 'brandId' | 'chemicalId' | 'colorId'> = {
        [InventoryType.HDPE]: 'brandId',
        [InventoryType.CHEMICAL]: 'chemicalId',
        [InventoryType.COLOR]: 'colorId',
    };
    const requiredField = fieldByType[data.type];
    if (!data[requiredField]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${requiredField} is required when type is ${data.type}`, path: [requiredField] });
    }
}

export const createInventorySchema = z
    .object({
        date: z.coerce.date().optional(),
        type: z.nativeEnum(InventoryType),
        brandId: z.string().uuid().optional(),
        chemicalId: z.string().uuid().optional(),
        colorId: z.string().uuid().optional(),
        quantityKg: z.coerce.number().positive('must be a positive number'),
    })
    .strict()
    .superRefine(requireMatchingItemId);

/**
 * Manual correction of a balance already on file (e.g. physical stock count
 * doesn't match the system) — only `weightKg`/`date` are adjustable. The item
 * identity (type/brandId/chemicalId/colorId) is fixed once a row exists;
 * if it's wrong, delete the row and let it get recreated by the next intake.
 */
export const updateInventorySchema = z
    .object({
        date: z.coerce.date(),
        weightKg: z.coerce.number().nonnegative('must not be negative'),
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
