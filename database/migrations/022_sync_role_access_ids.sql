-- ============================================================
-- Migration 022: Sync role_access_id between employees and users tables
-- ============================================================

-- Copy role_access_id from users to employees where employees.role_access_id is NULL
UPDATE employees e
SET role_access_id = u.role_access_id
FROM users u
WHERE e.id = u.id
  AND e.role_access_id IS NULL
  AND u.role_access_id IS NOT NULL;

-- Copy role_access_id from employees to users where users.role_access_id is NULL
UPDATE users u
SET role_access_id = e.role_access_id
FROM employees e
WHERE u.id = e.id
  AND u.role_access_id IS NULL
  AND e.role_access_id IS NOT NULL;
