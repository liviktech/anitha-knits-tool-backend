-- ============================================================
-- Migration: Users and employee details
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id             UUID NOT NULL PRIMARY KEY,
    company_id     UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    name           VARCHAR(150),
    mobile         VARCHAR(15) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    role           "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    is_active      BOOLEAN NOT NULL DEFAULT true,
    last_login_at  TIMESTAMPTZ(6),
    role_access_id UUID REFERENCES role_access (id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by     VARCHAR(100),
    updated_at     TIMESTAMPTZ(6) NOT NULL,
    updated_by     VARCHAR(100),
    -- mobile is only unique per company, not globally — see authService.loginUser.
    UNIQUE (company_id, mobile)
);

CREATE TABLE IF NOT EXISTS employee_details (
    id                            UUID NOT NULL PRIMARY KEY,
    user_id                       UUID NOT NULL UNIQUE REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    -- Server-generated only (companyCode + zero-padded companies.employee_seq), never client-supplied.
    custom_user_id                VARCHAR(60) NOT NULL UNIQUE,
    name                          VARCHAR(150),
    designation                   VARCHAR(100),
    address                       VARCHAR(500),
    gender                        "Gender",
    salary                        NUMERIC(12, 2),
    photo_url                     VARCHAR(500),
    aadhaar_number                VARCHAR(20),
    aadhaar_document_url          VARCHAR(500),
    document_name                 VARCHAR(255),
    aadhaar_document_uploaded_at  TIMESTAMPTZ(6),
    joining_date                  DATE,
    created_at                    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                    TIMESTAMPTZ(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS users_company_id_idx ON users (company_id);
CREATE INDEX IF NOT EXISTS users_company_id_role_idx ON users (company_id, role);
CREATE INDEX IF NOT EXISTS users_company_id_is_active_idx ON users (company_id, is_active);
CREATE INDEX IF NOT EXISTS users_role_access_id_idx ON users (role_access_id);
CREATE INDEX IF NOT EXISTS employee_details_user_id_idx ON employee_details (user_id);
