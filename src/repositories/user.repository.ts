import type pg from 'pg';
import { query, queryOne } from '../db/query.js';
import { withReadClient, withTransaction } from '../db/transaction.js';
import type { UserRole } from '../types/enums.js';

export interface LoginCandidateRow {
    id: string;
    companyId: string;
    name: string | null;
    mobile: string;
    passwordHash: string;
    role: UserRole;
    isActive: boolean;
    roleAccessId: string | null;
    companyName: string;
    companyCode: string;
    companyIsActive: boolean;
}

export async function findLoginCandidatesByMobile(mobile: string): Promise<LoginCandidateRow[]> {
    const result = await query<LoginCandidateRow>(
        `SELECT u.id, u.company_id AS "companyId", u.name, u.mobile, u.password_hash AS "passwordHash",
                u.role, u.is_active AS "isActive", u.role_access_id AS "roleAccessId",
                c.name AS "companyName", c.company_code AS "companyCode", c.is_active AS "companyIsActive"
         FROM users u
         JOIN companies c ON c.id = u.company_id
         WHERE u.mobile = $1`,
        [mobile],
    );
    return result.rows;
}

export async function findUserRoleAndAccessId(id: string, companyId: string): Promise<{ role: UserRole; roleAccessId: string | null } | null> {
    return queryOne<{ role: UserRole; roleAccessId: string | null }>(
        'SELECT role, role_access_id AS "roleAccessId" FROM users WHERE id = $1 AND company_id = $2',
        [id, companyId],
    );
}

export async function updateLastLogin(userId: string): Promise<void> {
    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);
}

/** Sets a freshly-hashed password (forgot-password flow) — never accepts a plaintext value. */
export async function updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [passwordHash, userId]);
}

export interface MeRow {
    id: string;
    companyId: string;
    name: string | null;
    mobile: string;
    role: UserRole;
    isActive: boolean;
    roleAccessId: string | null;
    companyName: string;
    companyCode: string;
}

export async function findUserForMe(userId: string, companyId: string): Promise<MeRow | null> {
    return queryOne<MeRow>(
        `SELECT u.id, u.company_id AS "companyId", u.name, u.mobile, u.role, u.is_active AS "isActive",
                u.role_access_id AS "roleAccessId", c.name AS "companyName", c.company_code AS "companyCode"
         FROM users u
         JOIN companies c ON c.id = u.company_id
         WHERE u.id = $1 AND u.company_id = $2`,
        [userId, companyId],
    );
}

export interface CompanyUserRow {
    id: string;
    companyId: string;
    name: string | null;
    mobile: string;
    role: UserRole;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ListCompanyUsersFilter {
    role?: UserRole;
    isActive?: boolean;
}

/** Platform-admin view: every role for one company (unlike listEmployees, which excludes ADMIN). */
export async function listCompanyUsers(
    companyId: string,
    filter: ListCompanyUsersFilter,
    skip: number,
    take: number,
): Promise<{ rows: CompanyUserRow[]; total: number }> {
    const conditions = ['u.company_id = $1'];
    const values: unknown[] = [companyId];
    if (filter.role) {
        values.push(filter.role);
        conditions.push(`u.role = $${values.length}`);
    }
    if (filter.isActive !== undefined) {
        values.push(filter.isActive);
        conditions.push(`u.is_active = $${values.length}`);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<CompanyUserRow>(
            `SELECT u.id, u.company_id AS "companyId", u.name, u.mobile, u.role, u.is_active AS "isActive",
                    u.last_login_at AS "lastLoginAt", u.created_at AS "createdAt", u.updated_at AS "updatedAt"
             FROM users u
             ${whereSql}
             ORDER BY u.created_at DESC
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users u ${whereSql}`, values);
        return { rows: rowsResult.rows, total: Number(countResult.rows[0]?.count ?? 0) };
    });
}

export interface BaseUserRow {
    id: string;
    companyId: string;
    name: string | null;
    mobile: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
}

/** Inserts the User row only — always call within the same transaction as insertEmployeeDetails (via `client`), so a failed detail insert never leaves an orphaned account. */
export async function insertUser(
    client: pg.PoolClient,
    input: { id?: string; companyId: string; name?: string | null; mobile: string; passwordHash: string; role: UserRole; roleAccessId?: string | null },
): Promise<BaseUserRow> {
    let result: pg.QueryResult<BaseUserRow>;
    if (input.id) {
        result = await client.query<BaseUserRow>(
            `INSERT INTO users (id, company_id, name, mobile, password_hash, role, role_access_id, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, now())
             RETURNING id, company_id AS "companyId", name, mobile, role, is_active AS "isActive", created_at AS "createdAt"`,
            [input.id, input.companyId, input.name ?? null, input.mobile, input.passwordHash, input.role, input.roleAccessId ?? null],
        );
    } else {
        result = await client.query<BaseUserRow>(
            `INSERT INTO users (id, company_id, name, mobile, password_hash, role, role_access_id, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())
             RETURNING id, company_id AS "companyId", name, mobile, role, is_active AS "isActive", created_at AS "createdAt"`,
            [input.companyId, input.name ?? null, input.mobile, input.passwordHash, input.role, input.roleAccessId ?? null],
        );
    }
    const row = result.rows[0];
    if (!row) throw new Error('Insert into users returned no row');
    return row;
}

export async function insertEmployeeDetails(
    client: pg.PoolClient,
    input: {
        userId: string;
        customUserId: string;
        designation?: string | null;
        address?: string | null;
        gender?: string | null;
        salary?: number | null;
        aadhaarNumber?: string | null;
        joiningDate?: Date | null;
        photoUrl?: string | null;
        aadhaarDocumentUrl?: string | null;
        documentName?: string | null;
        aadhaarDocumentUploadedAt?: Date | null;
    },
): Promise<EmployeeDetailsFullRow> {
    const result = await client.query<EmployeeDetailsFullRow>(
        `INSERT INTO employee_details (
            id, user_id, custom_user_id, designation, address, gender, salary, aadhaar_number,
            joining_date, photo_url, aadhaar_document_url, document_name, aadhaar_document_uploaded_at, updated_at
         )
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
         RETURNING custom_user_id AS "customUserId", designation, address, gender, salary,
                   aadhaar_number AS "aadhaarNumber", joining_date AS "joiningDate",
                   photo_url AS "photoUrl", aadhaar_document_url AS "aadhaarDocumentUrl",
                   document_name AS "documentName", aadhaar_document_uploaded_at AS "aadhaarDocumentUploadedAt"`,
        [
            input.userId,
            input.customUserId,
            input.designation ?? null,
            input.address ?? null,
            input.gender ?? null,
            input.salary ?? null,
            input.aadhaarNumber ?? null,
            input.joiningDate ?? null,
            input.photoUrl ?? null,
            input.aadhaarDocumentUrl ?? null,
            input.documentName ?? null,
            input.aadhaarDocumentUploadedAt ?? null,
        ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into employee_details returned no row');
    return row;
}

export async function countActiveUsersByRole(companyId: string, role: UserRole): Promise<number> {
    const table = role === 'EMPLOYEE' ? 'employees' : 'users';
    const row = await queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${table} WHERE company_id = $1 AND role = $2 AND is_active = true`,
        [companyId, role],
    );
    return Number(row?.count ?? 0);
}

export interface EmployeeRow extends BaseUserRow {
    updatedAt: Date;
    roleAccessId: string | null;
    roleAccessRoleName: string | null;
    employeeDetails: EmployeeDetailsFullRow | null;
}

export interface EmployeeDetailsFullRow {
    customUserId: string;
    designation: string | null;
    address: string | null;
    gender: string | null;
    salary: number | null;
    aadhaarNumber: string | null;
    joiningDate: Date | null;
    photoUrl: string | null;
    aadhaarDocumentUrl: string | null;
    documentName: string | null;
    aadhaarDocumentUploadedAt: Date | null;
}

const WORKFORCE_UNION_SQL = `
    SELECT e.id, e.company_id AS "companyId", e.name, e.mobile, e.role, e.is_active AS "isActive",
           e.created_at AS "createdAt", e.updated_at AS "updatedAt",
           e.role_access_id AS "roleAccessId", ra.role_name AS "roleAccessRoleName",
           e.custom_user_id AS "customUserId", e.designation, e.address, e.gender, e.salary,
           e.aadhaar_number AS "aadhaarNumber", e.joining_date AS "joiningDate", e.photo_url AS "photoUrl",
           e.aadhaar_document_url AS "aadhaarDocumentUrl", e.document_name AS "documentName",
           e.aadhaar_document_uploaded_at AS "aadhaarDocumentUploadedAt"
    FROM employees e
    LEFT JOIN role_access ra ON ra.id = e.role_access_id

    UNION ALL

    SELECT u.id, u.company_id AS "companyId", u.name, u.mobile, u.role, u.is_active AS "isActive",
           u.created_at AS "createdAt", u.updated_at AS "updatedAt",
           u.role_access_id AS "roleAccessId", ra.role_name AS "roleAccessRoleName",
           NULL AS "customUserId", u.role::text AS "designation", NULL AS "address", NULL AS "gender", NULL AS "salary",
           NULL AS "aadhaarNumber", NULL AS "joiningDate", NULL AS "photoUrl",
           NULL AS "aadhaarDocumentUrl", NULL AS "documentName",
           NULL AS "aadhaarDocumentUploadedAt"
    FROM users u
    LEFT JOIN role_access ra ON ra.id = u.role_access_id
    WHERE u.role IN ('MANAGER', 'SUPERVISOR')
`;

interface EmployeeQueryRow {
    id: string;
    companyId: string;
    name: string | null;
    mobile: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    roleAccessId: string | null;
    roleAccessRoleName: string | null;
    customUserId: string | null;
    designation: string | null;
    address: string | null;
    gender: string | null;
    salary: number | null;
    aadhaarNumber: string | null;
    joiningDate: Date | null;
    photoUrl: string | null;
    aadhaarDocumentUrl: string | null;
    documentName: string | null;
    aadhaarDocumentUploadedAt: Date | null;
}

function toEmployeeRow(row: EmployeeQueryRow): EmployeeRow {
    return {
        id: row.id,
        companyId: row.companyId,
        name: row.name,
        mobile: row.mobile,
        role: row.role,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        roleAccessId: row.roleAccessId,
        roleAccessRoleName: row.roleAccessRoleName,
        employeeDetails: row.customUserId
            ? {
                  customUserId: row.customUserId,
                  designation: row.designation,
                  address: row.address,
                  gender: row.gender,
                  salary: row.salary,
                  aadhaarNumber: row.aadhaarNumber,
                  joiningDate: row.joiningDate,
                  photoUrl: row.photoUrl,
                  aadhaarDocumentUrl: row.aadhaarDocumentUrl,
                  documentName: row.documentName,
                  aadhaarDocumentUploadedAt: row.aadhaarDocumentUploadedAt,
              }
            : null,
    };
}

export interface InsertEmployeeRecordInput {
    companyId: string;
    customUserId: string;
    userId?: string | null;
    name?: string | null;
    mobile: string;
    role: UserRole;
    designation?: string | null;
    address?: string | null;
    gender?: string | null;
    salary?: number | null;
    aadhaarNumber?: string | null;
    joiningDate?: Date | null;
    photoUrl?: string | null;
    aadhaarDocumentUrl?: string | null;
    documentName?: string | null;
    aadhaarDocumentUploadedAt?: Date | null;
}

export async function insertEmployeeRecord(
    client: pg.PoolClient,
    input: InsertEmployeeRecordInput,
): Promise<EmployeeRow> {
    const result = await client.query<EmployeeQueryRow>(
        `INSERT INTO employees (
            id, company_id, custom_user_id, user_id, name, mobile, role, designation, address, gender,
            salary, aadhaar_number, joining_date, photo_url, aadhaar_document_url, document_name,
            aadhaar_document_uploaded_at, is_active, created_at, updated_at
         )
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, now(), now())
         RETURNING id, company_id AS "companyId", custom_user_id AS "customUserId", user_id AS "userId", name, mobile, role,
                   is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt", designation, address,
                   gender, salary, aadhaar_number AS "aadhaarNumber", joining_date AS "joiningDate", photo_url AS "photoUrl",
                   aadhaar_document_url AS "aadhaarDocumentUrl", document_name AS "documentName",
                   aadhaar_document_uploaded_at AS "aadhaarDocumentUploadedAt"`,
        [
            input.companyId,
            input.customUserId,
            input.userId ?? null,
            input.name ?? null,
            input.mobile,
            input.role,
            input.designation ?? null,
            input.address ?? null,
            input.gender ?? null,
            input.salary ?? null,
            input.aadhaarNumber ?? null,
            input.joiningDate ?? null,
            input.photoUrl ?? null,
            input.aadhaarDocumentUrl ?? null,
            input.documentName ?? null,
            input.aadhaarDocumentUploadedAt ?? null,
        ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into employees returned no row');
    return toEmployeeRow(row);
}

export async function findEmployeeById(id: string, companyId: string, managedRoles?: UserRole[]): Promise<EmployeeRow | null> {
    const conditions = ['w."id" = $1', 'w."companyId" = $2'];
    const values: unknown[] = [id, companyId];
    if (managedRoles && managedRoles.length > 0) {
        values.push(managedRoles);
        conditions.push(`w.role = ANY($${values.length}::"UserRole"[])`);
    }
    const result = await query<EmployeeQueryRow>(
        `SELECT * FROM (${WORKFORCE_UNION_SQL}) w WHERE ${conditions.join(' AND ')}`,
        values,
    );
    const row = result.rows[0];
    return row ? toEmployeeRow(row) : null;
}

export async function existsUserWithRole(id: string, companyId: string, roles: UserRole[]): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>(
        `SELECT (EXISTS(SELECT 1 FROM employees WHERE id = $1 AND company_id = $2 AND role = ANY($3::"UserRole"[]))
              OR EXISTS(SELECT 1 FROM users WHERE id = $1 AND company_id = $2 AND role = ANY($3::"UserRole"[]))) AS exists`,
        [id, companyId, roles],
    );
    return row?.exists ?? false;
}

export interface ListEmployeesFilter {
    role?: UserRole;
    managedRoles: UserRole[];
    isActive?: boolean;
}

export async function listEmployees(
    companyId: string,
    filter: ListEmployeesFilter,
    skip: number,
    take: number,
): Promise<{ rows: EmployeeRow[]; total: number }> {
    const conditions = ['w."companyId" = $1'];
    const values: unknown[] = [companyId];

    if (filter.role) {
        values.push(filter.role);
        conditions.push(`w.role = $${values.length}`);
    } else {
        values.push(filter.managedRoles);
        conditions.push(`w.role = ANY($${values.length}::"UserRole"[])`);
    }
    if (filter.isActive !== undefined) {
        values.push(filter.isActive);
        conditions.push(`w."isActive" = $${values.length}`);
    } else {
        conditions.push(`w."isActive" = true`);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<EmployeeQueryRow>(
            `SELECT * FROM (${WORKFORCE_UNION_SQL}) w ${whereSql}
             ORDER BY w."createdAt" DESC
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM (${WORKFORCE_UNION_SQL}) w ${whereSql}`, values);
        return { rows: rowsResult.rows.map(toEmployeeRow), total: Number(countResult.rows[0]?.count ?? 0) };
    });
}

export interface UpdateEmployeePatch {
    name?: string;
    mobile?: string;
    role?: UserRole;
    isActive?: boolean;
    userId?: string | null;
    designation?: string | null;
    address?: string | null;
    gender?: string | null;
    salary?: number | null;
    aadhaarNumber?: string | null;
    joiningDate?: Date | null;
    photoUrl?: string;
    aadhaarDocumentUrl?: string;
    documentName?: string;
    aadhaarDocumentUploadedAt?: Date;
}

export async function updateEmployeeRecord(
    id: string,
    patch: UpdateEmployeePatch,
    client?: pg.PoolClient,
): Promise<void> {
    const execQuery = async (sql: string, params?: unknown[]) => {
        if (client) return client.query(sql, params);
        return query(sql, params);
    };

    const userRes = await execQuery('SELECT id FROM users WHERE id = $1', [id]);
    if (userRes.rows.length > 0) {
        const uSets: string[] = [];
        const uVals: unknown[] = [];
        if (patch.name !== undefined) {
            uVals.push(patch.name);
            uSets.push(`name = $${uVals.length}`);
        }
        if (patch.mobile !== undefined) {
            uVals.push(patch.mobile);
            uSets.push(`mobile = $${uVals.length}`);
        }
        if (patch.role !== undefined) {
            uVals.push(patch.role);
            uSets.push(`role = $${uVals.length}`);
        }
        if (patch.isActive !== undefined) {
            uVals.push(patch.isActive);
            uSets.push(`is_active = $${uVals.length}`);
        }
        if (uSets.length > 0) {
            uVals.push(id);
            await execQuery(`UPDATE users SET ${uSets.join(', ')}, updated_at = now() WHERE id = $${uVals.length}`, uVals);
        }
        return;
    }

    const columns: Record<keyof UpdateEmployeePatch, string> = {
        name: 'name',
        mobile: 'mobile',
        role: 'role',
        isActive: 'is_active',
        userId: 'user_id',
        designation: 'designation',
        address: 'address',
        gender: 'gender',
        salary: 'salary',
        aadhaarNumber: 'aadhaar_number',
        joiningDate: 'joining_date',
        photoUrl: 'photo_url',
        aadhaarDocumentUrl: 'aadhaar_document_url',
        documentName: 'document_name',
        aadhaarDocumentUploadedAt: 'aadhaar_document_uploaded_at',
    };
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const [key, column] of Object.entries(columns) as [keyof UpdateEmployeePatch, string][]) {
        if (patch[key] === undefined) continue;
        values.push(patch[key]);
        sets.push(`${column} = $${values.length}`);
    }

    if (sets.length === 0) return;

    values.push(id);
    const sql = `UPDATE employees SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`;

    await execQuery(sql, values);
}

export async function syncPromotedUser(
    client: pg.PoolClient,
    input: { companyId: string; name?: string | null; mobile?: string; passwordHash: string; role: UserRole; employeeId: string },
): Promise<string> {
    const empRes = await client.query<EmployeeQueryRow>(
        `SELECT * FROM employees WHERE id = $1 AND company_id = $2`,
        [input.employeeId, input.companyId],
    );
    const emp = empRes.rows[0];

    const mobile = input.mobile && input.mobile.length >= 10 ? input.mobile : emp?.mobile;
    const name = input.name ?? emp?.name ?? null;

    if (!mobile) {
        const userRes = await client.query<{ id: string; mobile: string; name: string | null }>(
            'SELECT id, mobile, name FROM users WHERE id = $1 AND company_id = $2',
            [input.employeeId, input.companyId],
        );
        const u = userRes.rows[0];
        if (u) {
            await client.query(
                `UPDATE users SET role = $1, password_hash = $2, is_active = true, updated_at = now() WHERE id = $3`,
                [input.role, input.passwordHash, u.id],
            );
            return u.id;
        }
        throw new Error(`Mobile number not found for employee ${input.employeeId}`);
    }

    const existingUser = await client.query<{ id: string }>(
        'SELECT id FROM users WHERE id = $1 OR (company_id = $2 AND mobile = $3)',
        [input.employeeId, input.companyId, mobile],
    );

    let userId: string;
    const roleAccessId = emp?.roleAccessId ?? null;

    if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0]!.id;
        await client.query(
            `UPDATE users SET name = $1, mobile = $2, password_hash = $3, role = $4, is_active = true, role_access_id = COALESCE($5, role_access_id), updated_at = now() WHERE id = $6`,
            [name, mobile, input.passwordHash, input.role, roleAccessId, userId],
        );
    } else {
        const userRow = await insertUser(client, {
            id: input.employeeId,
            companyId: input.companyId,
            name,
            mobile,
            passwordHash: input.passwordHash,
            role: input.role,
            roleAccessId,
        });
        userId = userRow.id;
    }

    // Remove from employees table so promoted Manager/Supervisor exists only in users table
    await client.query('DELETE FROM employees WHERE id = $1', [input.employeeId]);

    return userId;
}

export async function demotePromotedUser(client: pg.PoolClient, employeeId: string): Promise<void> {
    const userRes = await client.query<{ companyId: string; name: string | null; mobile: string; roleAccessId: string | null }>(
        'SELECT company_id AS "companyId", name, mobile, role_access_id AS "roleAccessId" FROM users WHERE id = $1',
        [employeeId],
    );
    const user = userRes.rows[0];

    if (user) {
        await client.query(
            `INSERT INTO employees (
                id, company_id, custom_user_id, name, mobile, role, role_access_id, is_active, created_at, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, 'EMPLOYEE', $6, true, now(), now())
             ON CONFLICT (id) DO UPDATE SET role = 'EMPLOYEE', role_access_id = EXCLUDED.role_access_id, is_active = true, updated_at = now()`,
            [
                employeeId,
                user.companyId,
                `EMP-${employeeId.slice(0, 6)}`,
                user.name,
                user.mobile,
                user.roleAccessId,
            ],
        );

        await client.query('DELETE FROM users WHERE id = $1', [employeeId]);
    }
}

export async function deleteEmployeeRecord(id: string): Promise<void> {
    await withTransaction(async (client) => {
        const emp = await client.query<{ userId: string | null }>(
            'SELECT user_id AS "userId" FROM employees WHERE id = $1',
            [id],
        );
        const userId = emp.rows[0]?.userId;

        await client.query('DELETE FROM attendances WHERE employee_id = $1', [id]);
        await client.query('DELETE FROM payroll_records WHERE employee_id = $1', [id]);
        await client.query('DELETE FROM salary_advances WHERE employee_id = $1', [id]);
        await client.query('DELETE FROM market_value_deductions WHERE employee_id = $1', [id]);
        await client.query('DELETE FROM other_deductions WHERE employee_id = $1', [id]);
        await client.query('DELETE FROM market_value_allocations WHERE employee_id = $1', [id]);

        await client.query('DELETE FROM employees WHERE id = $1', [id]);
        await client.query('DELETE FROM users WHERE id = $1', [id]);

        if (userId) {
            await client.query('DELETE FROM users WHERE id = $1', [userId]);
        }
    });
}

