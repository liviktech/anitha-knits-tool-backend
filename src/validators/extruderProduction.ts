import { z } from 'zod';

const uuidSchema = z.string().uuid();

const rawProductSchema = z.object({
    brandId: uuidSchema,
    bagCount: z.coerce.number().int().positive(),
    weightKg: z.coerce.number().positive(),
});

const wasteSchema = z.object({
    looseWasteKg: z.coerce.number().nonnegative(),
    lumsWasteKg: z.coerce.number().nonnegative(),
});

const chemicalSchema = z.object({
    chemicalId: uuidSchema,
    weightKg: z.coerce.number().positive(),
});

export const createExtruderProductionSchema = z.object({
    productionDate: z.coerce.date(),
    sizeId: uuidSchema,
    colorId: uuidSchema,
    colorWeightKg: z.coerce.number().positive(),
    createdBy: z.string().trim().min(1).max(100),
    rawProduct: rawProductSchema,
    waste: wasteSchema,
    chemical: chemicalSchema.optional(),
});

export const updateExtruderProductionSchema = z
    .object({
        productionDate: z.coerce.date().optional(),
        sizeId: uuidSchema.optional(),
        colorId: uuidSchema.optional(),
        colorWeightKg: z.coerce.number().positive().optional(),
        updatedBy: z.string().trim().min(1).max(100),
        // Nested blocks are replaced wholesale when provided, not merged field-by-field.
        rawProduct: rawProductSchema.optional(),
        waste: wasteSchema.optional(),
        // Explicit null removes the chemical association; omit the field to leave it untouched.
        chemical: chemicalSchema.nullable().optional(),
    })
    .refine(
        (data) =>
            data.productionDate !== undefined ||
            data.sizeId !== undefined ||
            data.colorId !== undefined ||
            data.colorWeightKg !== undefined ||
            data.rawProduct !== undefined ||
            data.waste !== undefined ||
            data.chemical !== undefined,
        { message: 'At least one field must be provided to update' },
    );

export const extruderProductionIdParamsSchema = z.object({
    id: uuidSchema,
});

export const listExtruderProductionQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    productionDate: z.coerce.date().optional(),
    sizeId: uuidSchema.optional(),
    colorId: uuidSchema.optional(),
});

export type CreateExtruderProductionInput = z.infer<typeof createExtruderProductionSchema>;
export type UpdateExtruderProductionInput = z.infer<typeof updateExtruderProductionSchema>;
export type ListExtruderProductionQuery = z.infer<typeof listExtruderProductionQuerySchema>;
