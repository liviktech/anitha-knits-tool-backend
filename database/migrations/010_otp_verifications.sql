-- ============================================================
-- Migration: OTP verifications (SMS OTP login + forgot-password via AWS Pinpoint)
-- One row per OTP request; invalidated (is_used=true) before a fresh one is
-- created so at most one active (unused, unexpired) OTP exists per
-- (mobile, purpose, actor_type) at a time — see otpService.requestOtp.
-- ============================================================

CREATE TYPE otp_purpose AS ENUM ('LOGIN', 'RESET_PASSWORD');
CREATE TYPE otp_actor_type AS ENUM ('COMPANY_USER', 'PLATFORM_ADMIN');

CREATE TABLE IF NOT EXISTS otp_verifications (
    id             UUID NOT NULL PRIMARY KEY,
    actor_type     otp_actor_type NOT NULL,
    purpose        otp_purpose NOT NULL,
    mobile         VARCHAR(15) NOT NULL,
    otp_hash       VARCHAR(255) NOT NULL,
    expires_at     TIMESTAMPTZ(6) NOT NULL,
    attempt_count  INTEGER NOT NULL DEFAULT 0,
    is_used        BOOLEAN NOT NULL DEFAULT false,
    consumed_at    TIMESTAMPTZ(6),
    created_at     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS otp_verifications_mobile_purpose_actor_type_idx ON otp_verifications (mobile, purpose, actor_type);
