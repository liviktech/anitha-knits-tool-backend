-- ============================================================
-- Migration: Dedicated employees table & role promotion linkage
-- ============================================================

CREATE TABLE IF NOT EXISTS employees (
    id                            UUID NOT NULL PRIMARY KEY,
    company_id                    UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    custom_user_id                VARCHAR(60) NOT NULL UNIQUE,
    user_id                       UUID REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL,
    name                          VARCHAR(150),
    mobile                        VARCHAR(15) NOT NULL,
    role                          "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
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
    is_active                     BOOLEAN NOT NULL DEFAULT true,
    created_at                    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, mobile)
);

CREATE INDEX IF NOT EXISTS employees_company_id_idx ON employees (company_id);
CREATE INDEX IF NOT EXISTS employees_company_id_role_idx ON employees (company_id, role);
CREATE INDEX IF NOT EXISTS employees_company_id_is_active_idx ON employees (company_id, is_active);
CREATE INDEX IF NOT EXISTS employees_user_id_idx ON employees (user_id);

-- Migrate existing non-admin employee details into the new employees table
INSERT INTO employees (
    id, company_id, custom_user_id, user_id, name, mobile, role, designation, address, gender, salary,
    photo_url, aadhaar_number, aadhaar_document_url, document_name, aadhaar_document_uploaded_at, joining_date,
    is_active, created_at, updated_at
)
SELECT
    u.id,
    u.company_id,
    ed.custom_user_id,
    CASE WHEN u.role IN ('MANAGER', 'SUPERVISOR') THEN u.id ELSE NULL END,
    COALESCE(u.name, ed.name),
    u.mobile,
    u.role,
    ed.designation,
    ed.address,
    ed.gender,
    ed.salary,
    ed.photo_url,
    ed.aadhaar_number,
    ed.aadhaar_document_url,
    ed.document_name,
    ed.aadhaar_document_uploaded_at,
    ed.joining_date,
    u.is_active,
    u.created_at,
    u.updated_at
FROM users u
JOIN employee_details ed ON ed.user_id = u.id
WHERE u.role IN ('EMPLOYEE', 'MANAGER', 'SUPERVISOR')
ON CONFLICT (id) DO NOTHING;

-- Remove regular non-promoted EMPLOYEE rows from users table so they cannot log in
DELETE FROM users
WHERE role = 'EMPLOYEE';
