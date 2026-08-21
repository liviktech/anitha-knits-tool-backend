import { z } from 'zod';

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

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
