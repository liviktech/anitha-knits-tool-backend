import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    CORS_ORIGINS: z
        .string()
        .default('')
        .transform((value) =>
            value
                .split(',')
                .map((origin) => origin.trim())
                .filter(Boolean),
        ),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z
        .string()
        .regex(/^\d+(ms|s|m|h|d)$/, 'JWT_EXPIRES_IN must look like 15m, 1h, 7d, 30s, 500ms')
        .default('15m'),
    JWT_COOKIE_NAME: z.string().default('access_token'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_REFRESH_EXPIRES_IN: z
        .string()
        .regex(/^\d+(ms|s|m|h|d)$/, 'JWT_REFRESH_EXPIRES_IN must look like 15m, 1h, 7d, 30s, 500ms')
        .default('7d'),
    JWT_REFRESH_COOKIE_NAME: z.string().default('refresh_token'),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().positive().default(10),
    // Deliberately separate secrets/cookies from the company-user tokens above, so a
    // platform-admin session and a company-user session never collide or get confused.
    PLATFORM_ADMIN_JWT_SECRET: z.string().min(32, 'PLATFORM_ADMIN_JWT_SECRET must be at least 32 characters'),
    PLATFORM_ADMIN_JWT_EXPIRES_IN: z
        .string()
        .regex(/^\d+(ms|s|m|h|d)$/, 'PLATFORM_ADMIN_JWT_EXPIRES_IN must look like 15m, 1h, 7d, 30s, 500ms')
        .default('15m'),
    PLATFORM_ADMIN_ACCESS_COOKIE_NAME: z.string().default('platform_admin_access_token'),
    PLATFORM_ADMIN_JWT_REFRESH_SECRET: z
        .string()
        .min(32, 'PLATFORM_ADMIN_JWT_REFRESH_SECRET must be at least 32 characters'),
    PLATFORM_ADMIN_JWT_REFRESH_EXPIRES_IN: z
        .string()
        .regex(/^\d+(ms|s|m|h|d)$/, 'PLATFORM_ADMIN_JWT_REFRESH_EXPIRES_IN must look like 15m, 1h, 7d, 30s, 500ms')
        .default('7d'),
    PLATFORM_ADMIN_REFRESH_COOKIE_NAME: z.string().default('platform_admin_refresh_token'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('Invalid environment configuration:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
