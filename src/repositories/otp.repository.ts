import { query, queryOne } from '../db/query.js';
import type { OtpActorType, OtpPurpose } from '../types/enums.js';

export interface OtpVerificationRow {
    id: string;
    actorType: OtpActorType;
    purpose: OtpPurpose;
    mobile: string;
    otpHash: string;
    expiresAt: Date;
    attemptCount: number;
    isUsed: boolean;
    consumedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Marks used any still-active (unused, unexpired) OTP for this (mobile, purpose, actorType) key —
 * call before creating a new OTP so at most one active OTP ever exists per key. Time: O(1); Space: O(1).
 */
export async function invalidateActiveOtps(mobile: string, purpose: OtpPurpose, actorType: OtpActorType): Promise<void> {
    await query(
        `UPDATE otp_verifications
         SET is_used = true, updated_at = now()
         WHERE mobile = $1 AND purpose = $2 AND actor_type = $3 AND is_used = false AND expires_at > now()`,
        [mobile, purpose, actorType],
    );
}

export async function createOtp(input: {
    actorType: OtpActorType;
    purpose: OtpPurpose;
    mobile: string;
    otpHash: string;
    expiresAt: Date;
}): Promise<OtpVerificationRow> {
    const row = await queryOne<OtpVerificationRow>(
        `INSERT INTO otp_verifications (id, actor_type, purpose, mobile, otp_hash, expires_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())
         RETURNING id, actor_type AS "actorType", purpose, mobile, otp_hash AS "otpHash",
                   expires_at AS "expiresAt", attempt_count AS "attemptCount", is_used AS "isUsed",
                   consumed_at AS "consumedAt", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [input.actorType, input.purpose, input.mobile, input.otpHash, input.expiresAt],
    );
    if (!row) throw new Error('Insert into otp_verifications returned no row');
    return row;
}

/** The one active (unused, unexpired) OTP for this key, if any — most recent first. Time: O(1); Space: O(1). */
export async function findActiveOtp(mobile: string, purpose: OtpPurpose, actorType: OtpActorType): Promise<OtpVerificationRow | null> {
    return queryOne<OtpVerificationRow>(
        `SELECT id, actor_type AS "actorType", purpose, mobile, otp_hash AS "otpHash",
                expires_at AS "expiresAt", attempt_count AS "attemptCount", is_used AS "isUsed",
                consumed_at AS "consumedAt", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM otp_verifications
         WHERE mobile = $1 AND purpose = $2 AND actor_type = $3 AND is_used = false AND expires_at > now()
         ORDER BY created_at DESC
         LIMIT 1`,
        [mobile, purpose, actorType],
    );
}

export async function incrementAttempt(id: string): Promise<void> {
    await query('UPDATE otp_verifications SET attempt_count = attempt_count + 1, updated_at = now() WHERE id = $1', [id]);
}

export async function markUsed(id: string): Promise<void> {
    await query('UPDATE otp_verifications SET is_used = true, consumed_at = now(), updated_at = now() WHERE id = $1', [id]);
}
