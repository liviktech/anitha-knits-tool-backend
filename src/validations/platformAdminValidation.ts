import { z } from 'zod';
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

export const platformAdminSignupSchema = z
    .object({
        name: z.string().trim().min(1).max(150),
        mobile: mobileSchema,
        password: z.string().min(8).max(128),
    })
    .strict();

export const platformAdminLoginSchema = z
    .object({
        mobile: mobileSchema,
        password: z.string().min(1).max(128),
    })
    .strict();

/** Purpose (LOGIN vs RESET_PASSWORD) is never client-supplied — each route hardcodes its own. */
export const platformAdminRequestOtpSchema = z
    .object({
        mobile: mobileSchema,
    })
    .strict();

export const platformAdminVerifyOtpLoginSchema = z
    .object({
        mobile: mobileSchema,
        otp: otpSchema,
    })
    .strict();

export const platformAdminVerifyOtpResetSchema = z
    .object({
        mobile: mobileSchema,
        otp: otpSchema,
    })
    .strict();

export const platformAdminResetPasswordSchema = z
    .object({
        mobile: mobileSchema,
        resetToken: z.string().min(1),
        newPassword: z.string().min(8).max(128),
    })
    .strict();

export type PlatformAdminSignupInput = z.infer<typeof platformAdminSignupSchema>;
export type PlatformAdminLoginInput = z.infer<typeof platformAdminLoginSchema>;
export type PlatformAdminRequestOtpInput = z.infer<typeof platformAdminRequestOtpSchema>;
export type PlatformAdminVerifyOtpLoginInput = z.infer<typeof platformAdminVerifyOtpLoginSchema>;
export type PlatformAdminVerifyOtpResetInput = z.infer<typeof platformAdminVerifyOtpResetSchema>;
export type PlatformAdminResetPasswordInput = z.infer<typeof platformAdminResetPasswordSchema>;
