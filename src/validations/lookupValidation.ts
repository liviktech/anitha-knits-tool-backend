import { z } from 'zod';

// Max lengths mirror each model's @db.VarChar(n) in schema.prisma.
const colorNameSchema = z.string().trim().min(1, 'name is required').max(50);
const sizeNameSchema = z.string().trim().min(1, 'name is required').max(30);
const chemicalNameSchema = z.string().trim().min(1, 'name is required').max(100);
const brandNameSchema = z.string().trim().min(1, 'name is required').max(100);

export const createColorSchema = z.object({ name: colorNameSchema }).strict();
export const createSizeSchema = z.object({ name: sizeNameSchema }).strict();
export const createChemicalSchema = z.object({ name: chemicalNameSchema }).strict();
export const createBrandSchema = z.object({ name: brandNameSchema }).strict();

export const updateColorSchema = z.object({ name: colorNameSchema }).strict();
export const updateSizeSchema = z.object({ name: sizeNameSchema }).strict();
export const updateChemicalSchema = z.object({ name: chemicalNameSchema }).strict();
export const updateBrandSchema = z.object({ name: brandNameSchema }).strict();

export const lookupIdParamsSchema = z.object({ id: z.string().uuid('id must be a valid UUID') }).strict();

export type CreateColorInput = z.infer<typeof createColorSchema>;
export type CreateSizeInput = z.infer<typeof createSizeSchema>;
export type CreateChemicalInput = z.infer<typeof createChemicalSchema>;
export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export type UpdateColorInput = z.infer<typeof updateColorSchema>;
export type UpdateSizeInput = z.infer<typeof updateSizeSchema>;
export type UpdateChemicalInput = z.infer<typeof updateChemicalSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;

export type LookupIdParams = z.infer<typeof lookupIdParamsSchema>;
