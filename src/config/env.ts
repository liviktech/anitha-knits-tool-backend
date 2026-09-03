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
    // Pool sizing is deliberately env-driven, not hard-coded: a long-running process (Render/local)
    // wants a real pool (today's default: 10), while a Lambda-behind-RDS-Proxy deployment should set
    // DB_POOL_MAX=1 per-instance and let RDS Proxy do the connection multiplexing across warm instances.
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
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
    AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
    AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
    AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
    AWS_S3_BUCKET_NAME: z.string().min(1, 'AWS_S3_BUCKET_NAME is required'),
    // AWS Pinpoint (SMS OTP) - reuses AWS_REGION/AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY above.
    PINPOINT_APPLICATION_ID: z.string().min(1, 'PINPOINT_APPLICATION_ID is required'),
    PINPOINT_SMS_TEMPLATE_LOGIN: z.string().min(1, 'PINPOINT_SMS_TEMPLATE_LOGIN is required'),
    PINPOINT_SMS_TEMPLATE_RESET: z.string().min(1, 'PINPOINT_SMS_TEMPLATE_RESET is required'),
    // Optional: SMSMessage.OriginationNumber is optional in the Pinpoint SDK — if unset, Pinpoint
    // assigns a random long code per message.
    PINPOINT_ORIGINATION_NUMBER: z.string().optional(),
    OTP_LENGTH: z.coerce.number().int().positive().default(6),
    OTP_TTL_MINUTES: z.coerce.number().int().positive().default(2),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    // Signs the short-lived token handed back after a successful RESET_PASSWORD OTP verify,
    // exchanged for the actual password reset — separate secret from JWT_SECRET.
    RESET_TOKEN_SECRET: z.string().min(32, 'RESET_TOKEN_SECRET must be at least 32 characters'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('Invalid environment configuration:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
