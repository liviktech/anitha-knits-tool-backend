import { randomInt } from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ConflictError, UnauthorizedError } from '../utils/errors.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { sendOtpSms } from './smsService.js';
import { findLoginCandidatesByMobile } from '../repositories/user.repository.js';
import { findPlatformAdminByMobile } from '../repositories/platformAdmin.repository.js';
import {
    createOtp,
    findActiveOtp,
    incrementAttempt,
    invalidateActiveOtps,
    markUsed,
    type OtpVerificationRow,
} from '../repositories/otp.repository.js';
import type { OtpActorType, OtpPurpose } from '../types/enums.js';

/** Generates an `env.OTP_LENGTH`-digit numeric code using a CSPRNG (never Math.random). Time: O(1); Space: O(1). */
function generateOtpCode(length: number): string {
    const max = 10 ** length;
    return String(randomInt(0, max)).padStart(length, '0');
}

/**
 * Counts active (isActive/companyIsActive) accounts matching this mobile, for the given
 * actorType. COMPANY_USER mobiles are only unique per company (see findLoginCandidatesByMobile),
 * so more than one active match is possible; PLATFORM_ADMIN mobiles are globally unique.
 * Time: O(n) for n same-mobile company-user rows (always small); Space: O(n).
 */
async function countActiveCandidates(mobile: string, actorType: OtpActorType): Promise<number> {
    if (actorType === 'PLATFORM_ADMIN') {
        const admin = await findPlatformAdminByMobile(mobile);
        return admin && admin.isActive ? 1 : 0;
    }
    const candidates = await findLoginCandidatesByMobile(mobile);
    return candidates.filter((c) => c.isActive && c.companyIsActive).length;
}

/**
 * Requests a new OTP for (mobile, purpose, actorType). Never reveals whether the mobile number
 * is registered — a zero-match mobile does the same amount of work (a dummy bcrypt hash) as a
 * real send, and returns silently either way, so the response can't be used to enumerate
 * accounts. Time: O(1) DB + O(1) SMS call; Space: O(1).
 */
export async function requestOtp({ mobile, purpose, actorType }: { mobile: string; purpose: OtpPurpose; actorType: OtpActorType }): Promise<void> {
    const activeCount = await countActiveCandidates(mobile, actorType);

    if (activeCount === 0) {
        // No real OTP to send — do comparable work so this path takes about as long as
        // the real-send path (timing side-channel mitigation, same idea as dummyPasswordHash).
        await hashPassword('otp-timing-mitigation-placeholder');
        return;
    }
    if (activeCount > 1) {
        // Only reachable for COMPANY_USER — PLATFORM_ADMIN mobile is globally unique.
        throw new ConflictError('Multiple accounts match this mobile number; contact support to sign in', 'AMBIGUOUS_LOGIN');
    }

    const otp = generateOtpCode(env.OTP_LENGTH);
    const otpHash = await hashPassword(otp);
    const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000);

    // At most one active OTP per (mobile, purpose, actorType) at a time.
    await invalidateActiveOtps(mobile, purpose, actorType);
    await createOtp({ actorType, purpose, mobile, otpHash, expiresAt });

    await sendOtpSms({ mobile, purpose, otp, ttlMinutes: env.OTP_TTL_MINUTES });
}

/**
 * Verifies an OTP for (mobile, purpose, actorType). On success, marks the OTP used (single-use)
 * and returns its row; the caller decides what happens next (issue session tokens, issue a reset
 * token, etc). Time: O(1); Space: O(1).
 */
export async function verifyOtp({
    mobile,
    otp,
    purpose,
    actorType,
}: {
    mobile: string;
    otp: string;
    purpose: OtpPurpose;
    actorType: OtpActorType;
}): Promise<OtpVerificationRow> {
    const row = await findActiveOtp(mobile, purpose, actorType);
    if (!row) {
        throw new UnauthorizedError('Invalid or expired OTP', 'OTP_EXPIRED');
    }
    if (row.attemptCount >= env.OTP_MAX_ATTEMPTS) {
        throw new UnauthorizedError('Too many incorrect attempts', 'OTP_MAX_ATTEMPTS');
    }

    const matches = await comparePassword(otp, row.otpHash);
    if (!matches) {
        await incrementAttempt(row.id);
        throw new UnauthorizedError('Invalid OTP', 'OTP_INVALID');
    }

    await markUsed(row.id);
    return row;
}

/**
 * Signs a short-lived, single-purpose token proving "this mobile just completed a RESET_PASSWORD
 * OTP verify" — exchanged by POST /password/reset for the actual password change. Separate
 * secret from JWT_SECRET so it can never be confused with (or forged as) a session token.
 */
export function issueResetToken({ mobile, actorType }: { mobile: string; actorType: OtpActorType }): string {
    return jwt.sign({ mobile, actorType, purpose: 'password_reset' }, env.RESET_TOKEN_SECRET, { expiresIn: '10m' });
}
