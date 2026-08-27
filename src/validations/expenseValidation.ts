import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const expenseIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export const createExpenseSchema = z
    .object({
        date: z.coerce.date().optional(),
        expenseName: z.string().trim().min(1).max(150),
        amount: z.coerce.number().positive('must be a positive number'),
    })
    .strict();

/** Every field is optional, but at least one must be present. expenseId is never client-supplied — it's generated server-side on create and immutable after. */
export const updateExpenseSchema = z
    .object({
        date: z.coerce.date(),
        expenseName: z.string().trim().min(1).max(150),
        amount: z.coerce.number().positive('must be a positive number'),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listExpenseQuerySchema = paginationSchema
    .extend({
        date_from: z.coerce.date().optional(),
        date_to: z.coerce.date().optional(),
        name: z.string().trim().min(1).optional(),
    })
    .strict();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpenseQuery = z.infer<typeof listExpenseQuerySchema>;
