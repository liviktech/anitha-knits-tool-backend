import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { booleanQueryParam, paginationSchema } from '../utils/pagination.js';

export const signupSchema = z
    .object({
        companyName: z.string().trim().min(1).max(150),
        companyAddress: z.string().trim().max(500).optional(),
        gst: z.string().trim().max(20).optional(),
        companyCode: z.string().trim().min(1).max(50),
        adminMobile: z
            .string()
            .trim()
            .regex(/^[0-9]{10,15}$/, 'adminMobile must be 10-15 digits'),
        adminPassword: z.string().min(8).max(128),
        adminName: z.string().trim().max(150).optional(),
    })
    .strict();

export const loginSchema = z
    .object({
        mobile: z
            .string()
            .trim()
            .regex(/^[0-9]{10,15}$/, 'mobile must be 10-15 digits'),
        password: z.string().min(1).max(128),
    })
    .strict();

export const companyIdParamsSchema = z
    .object({
        id: z.string().uuid('id must be a valid UUID'),
    })
    .strict();

export const listCompaniesQuerySchema = paginationSchema
    .extend({
        isActive: booleanQueryParam.optional(),
        name: z.string().trim().min(1).optional(),
    })
    .strict();

export const updateCompanySchema = z
    .object({
        name: z.string().trim().min(1).max(150),
        address: z.string().trim().max(500).nullable(),
        gst: z.string().trim().max(20).nullable(),
        companyCode: z.string().trim().min(1).max(50),
        adminMobile: z
            .string()
            .trim()
            .regex(/^[0-9]{10,15}$/, 'adminMobile must be 10-15 digits'),
        isActive: z.boolean(),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listCompanyUsersQuerySchema = paginationSchema
    .extend({
        role: z.nativeEnum(UserRole).optional(),
        isActive: booleanQueryParam.optional(),
    })
    .strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type ListCompanyUsersQuery = z.infer<typeof listCompanyUsersQuerySchema>;
