import { livikPool } from '../config/livikDb.js';
import { toPageMeta, toSkipTake } from '../utils/pagination.js';
import type { ListLivikEmployeesQuery } from '../validations/livikEmployeeValidation.js';

export interface LivikEmployee {
    id: string;
    empId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phoneNumber: string | null;
    designation: string | null;
    department: string | null;
    dateOfJoining: string | null;
    status: string;
    isActive: boolean;
    photo: string | null;
    createdAt: string;
}

/** Read-only listing against the Livik internal tool's own `Employee` table (separate database — see config/livikDb.ts). */
export async function listLivikEmployees(query: ListLivikEmployeesQuery) {
    const { skip, take } = toSkipTake(query);
    const search = query.search ? `%${query.search}%` : null;

    const whereClause = search
        ? `WHERE "firstName" ILIKE $1 OR "lastName" ILIKE $1 OR "empId" ILIKE $1 OR "email" ILIKE $1 OR "department" ILIKE $1 OR "designation" ILIKE $1`
        : '';
    const rowsParams = search ? [search, take, skip] : [take, skip];
    const countParams = search ? [search] : [];

    const [rowsResult, countResult] = await Promise.all([
        livikPool.query<LivikEmployee>(
            `SELECT "id", "empId", "firstName", "lastName", "email", "phoneNumber", "designation",
                    "department", "dateOfJoining", "status", "isActive", "photo", "created_at" AS "createdAt"
             FROM "Employee"
             ${whereClause}
             ORDER BY "created_at" DESC
             LIMIT $${search ? 2 : 1} OFFSET $${search ? 3 : 2}`,
            rowsParams,
        ),
        livikPool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM "Employee" ${whereClause}`,
            countParams,
        ),
    ]);

    const total = Number(countResult.rows[0]?.count ?? 0);
    return { items: rowsResult.rows, meta: toPageMeta(query, total) };
}
