-- ============================================================
-- Migration: Companies (tenants) and platform admins
-- Both are root tables with no foreign-key dependencies — companies is the
-- tenancy root every other per-company table hangs off; platform_admins is
-- the separate, company-independent operator-account table.
-- ============================================================

-- --- Companies (tenants) ---
CREATE TABLE IF NOT EXISTS companies (
    id                  UUID NOT NULL PRIMARY KEY,
    name                VARCHAR(150) NOT NULL,
    address             VARCHAR(500),
    gst                 VARCHAR(20) UNIQUE,
    admin_mobile        VARCHAR(15) NOT NULL UNIQUE,
    admin_password_hash VARCHAR(255) NOT NULL,
    company_code        VARCHAR(50) NOT NULL UNIQUE,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    -- Atomic, never-reissued sequence counters — see the *_seq columns' usage in
    -- userService.nextCustomUserId / lookup.ts's next{Color,Size,Chemical,Brand}Code.
    employee_seq        INTEGER NOT NULL DEFAULT 1,
    brand_seq           INTEGER NOT NULL DEFAULT 1,
    chemical_seq        INTEGER NOT NULL DEFAULT 1,
    color_seq           INTEGER NOT NULL DEFAULT 1,
    size_seq            INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ(6) NOT NULL
);

-- --- Platform admins (the SaaS operator's own accounts — not company-scoped) ---
CREATE TABLE IF NOT EXISTS platform_admins (
    id            UUID NOT NULL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    mobile        VARCHAR(15) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          "PlatformAdminRole" NOT NULL DEFAULT 'SUPER_ADMIN',
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS companies_name_idx ON companies (name);
CREATE INDEX IF NOT EXISTS companies_is_active_idx ON companies (is_active);
