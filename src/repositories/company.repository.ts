import { pool } from '../db/pool.js';
import { queryOne, type Queryable } from '../db/query.js';
import { withReadClient } from '../db/transaction.js';

export interface CompanyRow {
    id: string;
    name: string;
    address: string | null;
    gst: string | null;
    adminMobile: string;
    companyCode: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const COMPANY_COLUMNS_SQL = `
    id, name, address, gst,
    admin_mobile AS "adminMobile",
    company_code AS "companyCode",
    is_active AS "isActive",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
`;

export async function createCompany(
    input: {
        name: string;
        address?: string | null;
        gst?: string | null;
        adminMobile: string;
        adminPasswordHash: string;
        companyCode: string;
    },
    executor: Queryable = pool,
): Promise<CompanyRow> {
    const row = await queryOne<CompanyRow>(
        `INSERT INTO companies (id, name, address, gst, admin_mobile, admin_password_hash, company_code, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())
         RETURNING ${COMPANY_COLUMNS_SQL}`,
        [input.name, input.address ?? null, input.gst ?? null, input.adminMobile, input.adminPasswordHash, input.companyCode],
        executor,
    );
    if (!row) throw new Error('Insert into companies returned no row');
    return row;
}

export async function findCompanyById(id: string, executor: Queryable = pool): Promise<CompanyRow | null> {
    return queryOne<CompanyRow>(`SELECT ${COMPANY_COLUMNS_SQL} FROM companies WHERE id = $1`, [id], executor);
}

export async function existsCompanyById(id: string, executor: Queryable = pool): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM companies WHERE id = $1) AS exists', [id], executor);
    return row?.exists ?? false;
}

export interface UpdateCompanyPatch {
    name?: string;
    address?: string | null;
    gst?: string | null;
    companyCode?: string;
    adminMobile?: string;
    isActive?: boolean;
}

export async function updateCompany(id: string, patch: UpdateCompanyPatch): Promise<CompanyRow> {
    const columns: Record<keyof UpdateCompanyPatch, string> = {
        name: 'name',
        address: 'address',
        gst: 'gst',
        companyCode: 'company_code',
        adminMobile: 'admin_mobile',
        isActive: 'is_active',
    };

    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(columns) as [keyof UpdateCompanyPatch, string][]) {
        if (patch[key] === undefined) continue;
        values.push(patch[key]);
        sets.push(`${column} = $${values.length}`);
    }

    values.push(id);
    const row = await queryOne<CompanyRow>(
        `UPDATE companies SET ${sets.length > 0 ? sets.join(', ') : 'id = id'}, updated_at = now()
         WHERE id = $${values.length}
         RETURNING ${COMPANY_COLUMNS_SQL}`,
        values,
    );
    if (!row) throw new Error(`Update on companies returned no row for id ${id}`);
    return row;
}

export interface ListCompaniesFilter {
    isActive?: boolean;
    name?: string;
}

export async function listCompanies(
    filter: ListCompaniesFilter,
    skip: number,
    take: number,
): Promise<{ rows: CompanyRow[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filter.isActive !== undefined) {
        values.push(filter.isActive);
        conditions.push(`is_active = $${values.length}`);
    }
    if (filter.name) {
        values.push(`%${filter.name}%`);
        conditions.push(`name ILIKE $${values.length}`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return withReadClient(async (client) => {
        const rowsResult = await client.query<CompanyRow>(
            `SELECT ${COMPANY_COLUMNS_SQL} FROM companies ${whereSql}
             ORDER BY created_at DESC
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM companies ${whereSql}`,
            values,
        );
        return { rows: rowsResult.rows, total: Number(countResult.rows[0]?.count ?? 0) };
    });
}
