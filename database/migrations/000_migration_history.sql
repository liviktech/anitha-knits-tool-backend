-- ============================================================
-- Migration: Migration history tracking table
-- Run this first, before any other migration file.
-- ============================================================

CREATE TABLE IF NOT EXISTS migration_history (
    id         SERIAL PRIMARY KEY,
    filename   VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);
