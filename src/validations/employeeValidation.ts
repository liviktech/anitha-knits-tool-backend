import { z } from 'zod';
import { Gender } from '@prisma/client';
import { booleanQueryParam, paginationSchema } from '../utils/pagination.js';

export const employeeIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export const createEmployeeSchema = z
    .object({
        name: z.string().trim().max(150).optional(),
        mobile: z
            .string()
            .trim()
            .regex(/^[0-9]{10,15}$/, 'mobile must be 10-15 digits'),
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
    })
    .strict();

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
