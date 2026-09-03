import type pg from 'pg';

/**
 * Shared helpers used by both authService.signupCompany (creates the first ADMIN) and
 * employeeService (creates EMPLOYEE/MANAGER/SUPERVISOR users) — the managed-user CRUD that
 * used to live in this file (createManagedUser, listUsers, etc., backing the now-removed
 * /company/user routes) was consolidated into employeeService.ts, since it had zero frontend
 * callers and the two code paths were near-duplicates of each other.
 */

/** Column list (aliased to the API's camelCase shape) for the base employee-details projection used by authService's admin-user shape. */
export const EMPLOYEE_DETAILS_COLUMNS_SQL = `
    ed.custom_user_id AS "customUserId",
    ed.designation,
    ed.address,
    ed.gender,
    ed.salary,
    ed.joining_date AS "joiningDate",
    ed.aadhaar_document_url AS "aadhaarDocumentUrl",
    ed.document_name AS "documentName",
    ed.aadhaar_document_uploaded_at AS "aadhaarDocumentUploadedAt"
`;

export interface EmployeeDetailsRow {
    customUserId: string;
    designation: string | null;
    address: string | null;
    gender: string | null;
    salary: number | null;
    joiningDate: Date | null;
    aadhaarDocumentUrl: string | null;
    documentName: string | null;
    aadhaarDocumentUploadedAt: Date | null;
}

/**
 * Atomically assigns the next customUserId for a company: companyCode + a
 * zero-padded sequence (e.g. "AK001" + "001"). Reads `employee_seq` as a
 * counter, not a row count, so a later-deleted user/employeeDetails row can
 * never cause a number to be reissued. Must run inside the same transaction
 * (same `client`) as the User/EmployeeDetails create it backs, so a failed
 * create can't "burn" a sequence number that's then unaccounted for.
 * Time: O(1) — one row update, serialized by Postgres row-level locking under concurrent callers.
 */
export async function nextCustomUserId(client: pg.PoolClient, companyId: string): Promise<string> {
    const result = await client.query<{ companyCode: string; employeeSeq: number }>(
        `UPDATE companies
         SET employee_seq = employee_seq + 1
         WHERE id = $1
         RETURNING company_code AS "companyCode", employee_seq AS "employeeSeq"`,
        [companyId],
    );
    const company = result.rows[0];
    if (!company) throw new Error(`Company ${companyId} not found while assigning customUserId`);
    const seq = company.employeeSeq - 1;
    return `${company.companyCode}${String(seq).padStart(3, '0')}`;
}

/** Salary already comes back as a JS number (see the NUMERIC type parser registered in db/pool.ts) — this stays only to preserve the null-safety shape callers rely on. */
export function mapEmployeeDetails(details: EmployeeDetailsRow | null) {
    if (!details) return null;
    return { ...details, salary: details.salary ?? null };
}

export function withMappedEmployeeDetails<T extends { employeeDetails: EmployeeDetailsRow | null }>(user: T) {
    return { ...user, employeeDetails: mapEmployeeDetails(user.employeeDetails) };
}
