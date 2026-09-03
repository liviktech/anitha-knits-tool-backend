import { z } from 'zod';
import { UserRole } from '../types/enums.js';
import { booleanQueryParam, paginationSchema } from '../utils/pagination.js';
import { env } from '../config/env.js';

const mobileSchema = z
    .string()
    .trim()
    .regex(/^[0-9]{10,15}$/, 'mobile must be 10-15 digits');

const otpSchema = z
    .string()
    .trim()
    .regex(/^[0-9]+$/, 'otp must be numeric')
    .length(env.OTP_LENGTH, `otp must be ${env.OTP_LENGTH} digits`);

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

/** Purpose (LOGIN vs RESET_PASSWORD) is never client-supplied — each route hardcodes its own. */
export const requestOtpSchema = z
    .object({
        mobile: mobileSchema,
    })
    .strict();

export const verifyOtpLoginSchema = z
    .object({
        mobile: mobileSchema,
        otp: otpSchema,
    })
    .strict();

export const verifyOtpResetSchema = z
    .object({
        mobile: mobileSchema,
        otp: otpSchema,
    })
    .strict();

export const resetPasswordSchema = z
    .object({
        mobile: mobileSchema,
        resetToken: z.string().min(1),
        newPassword: z.string().min(8).max(128),
    })
    .strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type ListCompanyUsersQuery = z.infer<typeof listCompanyUsersQuerySchema>;
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpLoginInput = z.infer<typeof verifyOtpLoginSchema>;
export type VerifyOtpResetInput = z.infer<typeof verifyOtpResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
