import type pg from 'pg';
import { query } from '../db/query.js';
import type { AttendanceStatus } from '../types/enums.js';

export interface AttendanceRow {
    id: string;
    companyId: string;
    employeeId: string;
    date: Date;
    status: AttendanceStatus;
    remarks: string | null;
    createdAt: Date;
    createdBy: string | null;
    updatedAt: Date;
    updatedBy: string | null;
    employee: {
        id: string;
        name: string | null;
        employeeDetails: { customUserId: string; designation: string | null } | null;
    };
}

interface AttendanceQueryRow {
    id: string;
    companyId: string;
    employeeId: string;
    date: Date;
    status: AttendanceStatus;
    remarks: string | null;
    createdAt: Date;
    createdBy: string | null;
    updatedAt: Date;
    updatedBy: string | null;
    employeeName: string | null;
    customUserId: string | null;
    designation: string | null;
}

export async function findAttendanceRecords(companyId: string, dateFrom: Date, dateTo: Date): Promise<AttendanceRow[]> {
    const result = await query<AttendanceQueryRow>(
        `SELECT a.id, a.company_id AS "companyId", a.employee_id AS "employeeId", a.date, a.status, a.remarks,
                a.created_at AS "createdAt", a.created_by AS "createdBy", a.updated_at AS "updatedAt", a.updated_by AS "updatedBy",
                u.name AS "employeeName", ed.custom_user_id AS "customUserId", ed.designation
         FROM attendances a
         JOIN users u ON u.id = a.employee_id
         LEFT JOIN employee_details ed ON ed.user_id = u.id
         WHERE a.company_id = $1 AND a.date >= $2 AND a.date <= $3
         ORDER BY a.date DESC`,
        [companyId, dateFrom, dateTo],
    );
    return result.rows.map((row) => ({
        id: row.id,
        companyId: row.companyId,
        employeeId: row.employeeId,
        date: row.date,
        status: row.status,
        remarks: row.remarks,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
        employee: {
            id: row.employeeId,
            name: row.employeeName,
            employeeDetails: row.customUserId ? { customUserId: row.customUserId, designation: row.designation } : null,
        },
    }));
}

export interface UpsertedAttendanceRow {
    id: string;
    companyId: string;
    employeeId: string;
    date: Date;
    status: AttendanceStatus;
    remarks: string | null;
    createdAt: Date;
    createdBy: string | null;
    updatedAt: Date;
    updatedBy: string | null;
}

export async function upsertAttendance(
    client: pg.PoolClient,
    input: { companyId: string; employeeId: string; date: Date; status: AttendanceStatus; remarks: string | null; actor: string },
): Promise<UpsertedAttendanceRow> {
    const result = await client.query<UpsertedAttendanceRow>(
        `INSERT INTO attendances (id, company_id, employee_id, date, status, remarks, created_by, updated_by, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $6, now())
         ON CONFLICT (company_id, employee_id, date)
         DO UPDATE SET status = EXCLUDED.status, remarks = EXCLUDED.remarks, updated_by = EXCLUDED.updated_by, updated_at = now()
         RETURNING id, company_id AS "companyId", employee_id AS "employeeId", date, status, remarks,
                   created_at AS "createdAt", created_by AS "createdBy", updated_at AS "updatedAt", updated_by AS "updatedBy"`,
        [input.companyId, input.employeeId, input.date, input.status, input.remarks, input.actor],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Upsert into attendances returned no row');
    return row;
}
