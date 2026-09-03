-- ============================================================
-- Migration: Access control catalog (modules, tabs, rights, roles)
-- role_access is created here (not in 005_users_and_employees.sql) because
-- users.role_access_id references it — this file must run first.
-- ============================================================

-- --- Roles (named bundles of rights, assignable to users) ---
CREATE TABLE IF NOT EXISTS role_access (
    id          UUID NOT NULL PRIMARY KEY,
    company_id  UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    role_name   VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    created_at  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ(6) NOT NULL,
    UNIQUE (company_id, role_name)
);

-- --- Modules (top-level sidebar sections, e.g. "Employees", "Inventory") ---
CREATE TABLE IF NOT EXISTS modules (
    id          UUID NOT NULL PRIMARY KEY,
    company_id  UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    module_code VARCHAR(50) NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ(6) NOT NULL,
    UNIQUE (company_id, module_code)
);

-- --- Tabs (sub-sections within a module, e.g. Employees > Payroll) ---
CREATE TABLE IF NOT EXISTS tabs (
    id         UUID NOT NULL PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    module_id  UUID NOT NULL REFERENCES modules (id) ON UPDATE CASCADE ON DELETE CASCADE,
    tab_code   VARCHAR(50) NOT NULL,
    tab_name   VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL,
    UNIQUE (company_id, module_id, tab_code)
);

-- --- Rights (Module [+ optional Tab] x Action grants an admin can assign to a role) ---
CREATE TABLE IF NOT EXISTS rights (
    id           UUID NOT NULL PRIMARY KEY,
    company_id   UUID NOT NULL REFERENCES companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
    module_id    UUID NOT NULL REFERENCES modules (id) ON UPDATE CASCADE ON DELETE CASCADE,
    -- NULL = the whole module, not one specific tab (most modules have no tabs at all).
    tab_id       UUID REFERENCES tabs (id) ON UPDATE CASCADE ON DELETE CASCADE,
    action       "RightAction" NOT NULL,
    -- Both server-derived from module/tab/action — never admin-typed. rightName is the stable
    -- identifier @@unique actually enforces (see the schema comment history on this column).
    right_name   VARCHAR(150) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ(6) NOT NULL,
    UNIQUE (company_id, right_name)
);

-- --- Role <-> Right assignments (many-to-many) ---
CREATE TABLE IF NOT EXISTS role_access_rights (
    id             UUID NOT NULL PRIMARY KEY,
    role_access_id UUID NOT NULL REFERENCES role_access (id) ON UPDATE CASCADE ON DELETE CASCADE,
    right_id       UUID NOT NULL REFERENCES rights (id) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (role_access_id, right_id)
);

CREATE INDEX IF NOT EXISTS role_access_company_id_idx ON role_access (company_id);
CREATE INDEX IF NOT EXISTS modules_company_id_idx ON modules (company_id);
CREATE INDEX IF NOT EXISTS tabs_company_id_idx ON tabs (company_id);
CREATE INDEX IF NOT EXISTS tabs_module_id_idx ON tabs (module_id);
CREATE INDEX IF NOT EXISTS rights_company_id_idx ON rights (company_id);
CREATE INDEX IF NOT EXISTS rights_module_id_idx ON rights (module_id);
CREATE INDEX IF NOT EXISTS rights_tab_id_idx ON rights (tab_id);
CREATE INDEX IF NOT EXISTS role_access_rights_right_id_idx ON role_access_rights (right_id);
