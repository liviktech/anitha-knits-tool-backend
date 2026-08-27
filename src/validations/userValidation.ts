import { z } from 'zod';
import { Gender, UserRole } from '@prisma/client';
import { booleanQueryParam, paginationSchema } from '../utils/pagination.js';

// Deliberately excludes ADMIN (no self-service admin creation) and EMPLOYEE (out of scope for this endpoint).
export const managedUserRoleSchema = z.enum(['MANAGER', 'SUPERVISOR']);

export const userIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

// Document fields (aadhaarDocumentUrl/documentName/aadhaarDocumentUploadedAt) are read-only here —
// there's no upload endpoint yet, so they aren't accepted through this JSON body.
const employeeDetailsSchema = z
    .object({
        designation: z.string().trim().max(100).optional(),
        address: z.string().trim().max(500).optional(),
        gender: z.nativeEnum(Gender).optional(),
        salary: z.coerce.number().nonnegative('must not be negative').optional(),
        joiningDate: z.coerce.date().optional(),
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
        employeeDetails: employeeDetailsSchema.optional(),
    })
    .strict();

export const updateUserSchema = z
    .object({
        name: z.string().trim().max(150),
        role: managedUserRoleSchema,
        isActive: z.boolean(),
        employeeDetails: employeeDetailsSchema,
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listUsersQuerySchema = paginationSchema
    .extend({
        role: managedUserRoleSchema.optional(),
        isActive: booleanQueryParam.optional(),
    })
    .strict();

export const listAllUsersQuerySchema = paginationSchema
    .extend({
        role: z.nativeEnum(UserRole).optional(),
        isActive: booleanQueryParam.optional(),
    })
    .strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ListAllUsersQuery = z.infer<typeof listAllUsersQuerySchema>;
