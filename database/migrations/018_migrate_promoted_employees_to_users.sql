-- Migration 018: Auto-migrate any existing Manager/Supervisor records in employees table to users table

INSERT INTO users (
    id, company_id, name, mobile, password_hash, role, role_access_id, is_active, created_at, updated_at
)
SELECT 
    e.id,
    e.company_id,
    e.name,
    e.mobile,
    CASE 
        WHEN e.role = 'MANAGER' OR UPPER(ra.role_name) LIKE '%MANAGER%' THEN '$2b$10$SG6vXOZ6.Skn84gbXh3oSuov5dzstDGCQoCfwbLjYlm6a6CdQ/Qja'
        ELSE '$2b$10$W9Ecyqebe.RuKD5iBRhOKu18SDfkuIUuAfa1teOIk2youxUDrWrCq'
    END AS password_hash,
    CASE 
        WHEN e.role = 'MANAGER' OR UPPER(ra.role_name) LIKE '%MANAGER%' THEN 'MANAGER'::"UserRole"
        ELSE 'SUPERVISOR'::"UserRole"
    END AS role,
    e.role_access_id,
    e.is_active,
    e.created_at,
    now()
FROM employees e
LEFT JOIN role_access ra ON ra.id = e.role_access_id
WHERE e.role IN ('MANAGER', 'SUPERVISOR')
   OR UPPER(ra.role_name) LIKE '%MANAGER%'
   OR UPPER(ra.role_name) LIKE '%SUPERVISOR%'
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    password_hash = EXCLUDED.password_hash,
    role_access_id = EXCLUDED.role_access_id,
    updated_at = now();

-- Delete migrated managers and supervisors from employees table
DELETE FROM employees
WHERE id IN (
    SELECT u.id FROM users u WHERE u.role IN ('MANAGER', 'SUPERVISOR')
);
