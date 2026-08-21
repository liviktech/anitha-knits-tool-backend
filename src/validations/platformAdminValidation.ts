import { z } from 'zod';

export const platformAdminSignupSchema = z
    .object({
        name: z.string().trim().min(1).max(150),
        mobile: z
            .string()
            .trim()
            .regex(/^[0-9]{10,15}$/, 'mobile must be 10-15 digits'),
        password: z.string().min(8).max(128),
    })
    .strict();

export const platformAdminLoginSchema = z
    .object({
        mobile: z
            .string()
            .trim()
            .regex(/^[0-9]{10,15}$/, 'mobile must be 10-15 digits'),
        password: z.string().min(1).max(128),
    })
    .strict();

export type PlatformAdminSignupInput = z.infer<typeof platformAdminSignupSchema>;
export type PlatformAdminLoginInput = z.infer<typeof platformAdminLoginSchema>;
