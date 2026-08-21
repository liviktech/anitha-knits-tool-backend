import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

// Deliberately excludes ADMIN (no self-service admin creation) and EMPLOYEE (out of scope for this endpoint).
export const managedUserRoleSchema = z.enum(['MANAGER', 'SUPERVISOR']);

export const userIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export const createUserSchema = z
    .object({
        name: z.string().trim().max(150).optional(),
        mobile: z
            .string()
            .trim()
            .regex(/^[0-9]{10,15}$/, 'mobile must be 10-15 digits'),
        password: z.string().min(8).max(128),
        role: managedUserRoleSchema,
    })
    .strict();

export const updateUserSchema = z
    .object({
        name: z.string().trim().max(150),
        role: managedUserRoleSchema,
        isActive: z.boolean(),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listUsersQuerySchema = paginationSchema
    .extend({
        role: managedUserRoleSchema.optional(),
        isActive: z.coerce.boolean().optional(),
    })
    .strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
