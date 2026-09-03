import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

/**
 * Throttles OTP-request endpoints only (never /login or any other route) — SMS sends cost money
 * and an unthrottled endpoint is an easy way to spam a phone number or burn through a Pinpoint
 * budget. Keyed by the requested mobile number when present (so one phone number can't be
 * hammered from many IPs), falling back to IP for malformed bodies that never reach validation.
 */
export const otpRequestLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 3,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
        const mobile = req.body?.mobile;
        if (typeof mobile === 'string' && mobile.trim().length > 0) {
            return mobile.trim();
        }
        return ipKeyGenerator(req.ip ?? '');
    },
    message: {
        success: false,
        error: {
            code: 'OTP_RATE_LIMITED',
            message: 'Too many OTP requests. Please try again later.',
        },
    },
});
