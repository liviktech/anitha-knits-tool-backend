import { z } from 'zod';
import { InventoryType } from '../types/enums.js';
import { paginationSchema } from '../utils/pagination.js';

export const openingBalanceRawMaterialGroupIdParamsSchema = z
    .object({
        groupId: z.string().uuid('groupId must be a valid UUID'),
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

export const openingBalanceRawMaterialItemSchema = z
    .object({
        type: z.nativeEnum(InventoryType),
        brandId: z.string().uuid().optional(),
        chemicalId: z.string().uuid().optional(),
        colorId: z.string().uuid().optional(),
        weightKg: z.coerce.number().nonnegative('must not be negative'),
        // Only meaningful for HDPE — a chemical/color opening balance has no bag count.
        bagCount: z.coerce.number().int().nonnegative('must not be negative').optional(),
    })
    .strict()
    .superRefine(requireMatchingItemId);

export const createOpeningBalanceRawMaterialSchema = z
    .object({
        date: z.coerce.date(),
        items: z.array(openingBalanceRawMaterialItemSchema).min(1, 'At least one item is required'),
    })
    .strict();

/** Replaces the whole group for its date — same shape as create, applied to an existing groupId. */
export const updateOpeningBalanceRawMaterialSchema = createOpeningBalanceRawMaterialSchema;

export const listOpeningBalanceRawMaterialQuerySchema = paginationSchema
    .extend({
        date_from: z.coerce.date().optional(),
        date_to: z.coerce.date().optional(),
        type: z.nativeEnum(InventoryType).optional(),
    })
    .strict();

export type OpeningBalanceRawMaterialItemInput = z.infer<typeof openingBalanceRawMaterialItemSchema>;
export type CreateOpeningBalanceRawMaterialInput = z.infer<typeof createOpeningBalanceRawMaterialSchema>;
export type UpdateOpeningBalanceRawMaterialInput = z.infer<typeof updateOpeningBalanceRawMaterialSchema>;
export type ListOpeningBalanceRawMaterialQuery = z.infer<typeof listOpeningBalanceRawMaterialQuerySchema>;
