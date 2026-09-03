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
    input: { companyId: string; name?: string | null; mobile: string; passwordHash: string; role: UserRole },
): Promise<BaseUserRow> {
    const result = await client.query<BaseUserRow>(
        `INSERT INTO users (id, company_id, name, mobile, password_hash, role, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())
         RETURNING id, company_id AS "companyId", name, mobile, role, is_active AS "isActive", created_at AS "createdAt"`,
        [input.companyId, input.name ?? null, input.mobile, input.passwordHash, input.role],
    );
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
    const row = await queryOne<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM users WHERE company_id = $1 AND role = $2 AND is_active = true',
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

const EMPLOYEE_ROW_SQL = `
    SELECT u.id, u.company_id AS "companyId", u.name, u.mobile, u.role, u.is_active AS "isActive",
           u.created_at AS "createdAt", u.updated_at AS "updatedAt", u.role_access_id AS "roleAccessId",
           ra.role_name AS "roleAccessRoleName",
           ed.custom_user_id AS "customUserId", ed.designation, ed.address, ed.gender, ed.salary,
           ed.aadhaar_number AS "aadhaarNumber", ed.joining_date AS "joiningDate", ed.photo_url AS "photoUrl",
           ed.aadhaar_document_url AS "aadhaarDocumentUrl", ed.document_name AS "documentName",
           ed.aadhaar_document_uploaded_at AS "aadhaarDocumentUploadedAt"
    FROM users u
    LEFT JOIN role_access ra ON ra.id = u.role_access_id
    LEFT JOIN employee_details ed ON ed.user_id = u.id
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

export async function findEmployeeById(id: string, companyId: string, managedRoles: UserRole[]): Promise<EmployeeRow | null> {
    const result = await query<EmployeeQueryRow>(
        `${EMPLOYEE_ROW_SQL} WHERE u.id = $1 AND u.company_id = $2 AND u.role = ANY($3::"UserRole"[])`,
        [id, companyId, managedRoles],
    );
    const row = result.rows[0];
    return row ? toEmployeeRow(row) : null;
}

export async function existsUserWithRole(id: string, companyId: string, roles: UserRole[]): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND company_id = $2 AND role = ANY($3::"UserRole"[])) AS exists`,
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
    const conditions = ['u.company_id = $1'];
    const values: unknown[] = [companyId];

    if (filter.role) {
        values.push(filter.role);
        conditions.push(`u.role = $${values.length}`);
    } else {
        values.push(filter.managedRoles);
        conditions.push(`u.role = ANY($${values.length}::"UserRole"[])`);
    }
    if (filter.isActive !== undefined) {
        values.push(filter.isActive);
        conditions.push(`u.is_active = $${values.length}`);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<EmployeeQueryRow>(
            `${EMPLOYEE_ROW_SQL} ${whereSql}
             ORDER BY u.created_at DESC
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users u ${whereSql}`, values);
        return { rows: rowsResult.rows.map(toEmployeeRow), total: Number(countResult.rows[0]?.count ?? 0) };
    });
}

export interface UpdateUserPatch {
    name?: string;
    mobile?: string;
    isActive?: boolean;
}

export interface UpdateEmployeeDetailsPatch {
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

/** Header (users) + 1:1 detail (employee_details) update, atomic — mirrors the Prisma nested-update call this replaces. */
export async function updateUserAndEmployeeDetails(
    id: string,
    userPatch: UpdateUserPatch,
    detailsPatch: UpdateEmployeeDetailsPatch,
): Promise<void> {
    await withTransaction(async (client) => {
        const userColumns: Record<keyof UpdateUserPatch, string> = { name: 'name', mobile: 'mobile', isActive: 'is_active' };
        const userSets: string[] = [];
        const userValues: unknown[] = [];
        for (const [key, column] of Object.entries(userColumns) as [keyof UpdateUserPatch, string][]) {
            if (userPatch[key] === undefined) continue;
            userValues.push(userPatch[key]);
            userSets.push(`${column} = $${userValues.length}`);
        }
        if (userSets.length > 0) {
            userValues.push(id);
            await client.query(`UPDATE users SET ${userSets.join(', ')}, updated_at = now() WHERE id = $${userValues.length}`, userValues);
        }

        const detailColumns: Record<keyof UpdateEmployeeDetailsPatch, string> = {
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
        const detailSets: string[] = [];
        const detailValues: unknown[] = [];
        for (const [key, column] of Object.entries(detailColumns) as [keyof UpdateEmployeeDetailsPatch, string][]) {
            if (detailsPatch[key] === undefined) continue;
            detailValues.push(detailsPatch[key]);
            detailSets.push(`${column} = $${detailValues.length}`);
        }
        if (detailSets.length > 0) {
            detailValues.push(id);
            await client.query(
                `UPDATE employee_details SET ${detailSets.join(', ')}, updated_at = now() WHERE user_id = $${detailValues.length}`,
                detailValues,
            );
        }
    });
}

export async function softDeleteUser(id: string): Promise<void> {
    await query('UPDATE users SET is_active = false WHERE id = $1', [id]);
}
