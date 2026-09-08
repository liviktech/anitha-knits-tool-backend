-- Migration 019: Keep all employees in employees table
-- Re-inserts MANAGER and SUPERVISOR users back into the employees table
-- so that their custom_user_id is preserved and they exist in both tables.

-- Insert all active MANAGER and SUPERVISOR from users table back into employees table
-- if they don't already exist there. We try to find a previously "burned" custom_user_id
-- for them from the sequence, but if not possible, we'll assign a placeholder or use the next sequence.
-- Since they were previously in employees table before promotion, they might have had one.
-- In our schema, custom_user_id is unique.

DO $$
DECLARE
    user_row RECORD;
    company_rec RECORD;
    new_custom_id VARCHAR;
BEGIN
    FOR user_row IN 
        SELECT id, company_id, name, mobile, role, role_access_id, created_at, updated_at, is_active
        FROM users
        WHERE role IN ('MANAGER', 'SUPERVISOR')
          AND id NOT IN (SELECT id FROM employees)
    LOOP
        -- Find company code to generate custom_user_id
        SELECT company_code, employee_seq INTO company_rec FROM companies WHERE id = user_row.company_id;
        
        IF company_rec.company_code IS NOT NULL THEN
            -- We'll increment the sequence to give them a valid custom_user_id
            UPDATE companies SET employee_seq = employee_seq + 1 WHERE id = user_row.company_id
            RETURNING employee_seq - 1 INTO company_rec.employee_seq;
            
            new_custom_id := 'EMP-' || lpad(company_rec.employee_seq::text, 3, '0');
            
            INSERT INTO employees (
                id, company_id, custom_user_id, name, mobile, role, role_access_id, is_active, created_at, updated_at
            ) VALUES (
                user_row.id, user_row.company_id, new_custom_id, user_row.name, user_row.mobile, 
                user_row.role, user_row.role_access_id, user_row.is_active, user_row.created_at, user_row.updated_at
            );
        END IF;
    END LOOP;
END $$;
