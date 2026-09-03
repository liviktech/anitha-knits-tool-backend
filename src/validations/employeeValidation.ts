import { z } from 'zod';
import { Gender, UserRole } from '../types/enums.js';
import { booleanQueryParam, paginationSchema } from '../utils/pagination.js';

export const employeeIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

// Managed roles this endpoint can create — no self-service ADMIN creation here.
export const managedRoleSchema = z.enum(['EMPLOYEE', 'MANAGER', 'SUPERVISOR']);

export const createEmployeeSchema = z
    .object({
        name: z.string().trim().max(150).optional(),
        mobile: z
            .string()
            .trim()
            .regex(/^[0-9]{10,15}$/, 'mobile must be 10-15 digits'),
        // Empty string accepted — the Employees Directory no longer collects a password up
        // front; a non-empty value must still meet the normal length bounds.
        password: z.union([z.literal(''), z.string().min(8).max(128)]),
        role: managedRoleSchema.default(UserRole.EMPLOYEE),
        designation: z.string().trim().max(100).optional(),
        address: z.string().trim().max(500).optional(),
        gender: z.nativeEnum(Gender).optional(),
        salary: z.coerce.number().nonnegative('must not be negative').optional(),
        aadhaarNumber: z.string().trim().max(20).optional(),
        joiningDate: z.coerce.date().optional(),
    })
    .strict();

export const updateEmployeeSchema = z
    .object({
        name: z.string().trim().max(150),
        mobile: z
            .string()
            .trim()
            .regex(/^[0-9]{10,15}$/, 'mobile must be 10-15 digits'),
        isActive: booleanQueryParam,
        designation: z.string().trim().max(100).optional(),
        address: z.string().trim().max(500).optional(),
        gender: z.nativeEnum(Gender).optional(),
        salary: z.coerce.number().nonnegative('must not be negative').optional(),
        aadhaarNumber: z.string().trim().max(20).optional(),
        joiningDate: z.coerce.date().optional(),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listEmployeesQuerySchema = paginationSchema
    .extend({
        isActive: booleanQueryParam.optional(),
        role: managedRoleSchema.optional(),
    })
    .strict();

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
