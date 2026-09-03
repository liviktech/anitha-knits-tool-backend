import type pg from 'pg';
import { query, queryOne } from '../db/query.js';
import { withReadClient } from '../db/transaction.js';

export interface ModuleRow {
    id: string;
    moduleCode: string;
    moduleName: string;
    createdAt: Date;
    updatedAt: Date;
}

const MODULE_COLUMNS_SQL = `id, module_code AS "moduleCode", module_name AS "moduleName", created_at AS "createdAt", updated_at AS "updatedAt"`;

/** Used by authService.signupCompany's default-catalog seeding (needs only the id back). */
export async function insertModule(
    client: pg.PoolClient,
    input: { companyId: string; moduleCode: string; moduleName: string },
): Promise<{ id: string }> {
    const result = await client.query<{ id: string }>(
        'INSERT INTO modules (id, company_id, module_code, module_name, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, now()) RETURNING id',
        [input.companyId, input.moduleCode, input.moduleName],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into modules returned no row');
    return row;
}

export async function createModule(input: { companyId: string; moduleCode: string; moduleName: string }): Promise<ModuleRow> {
    const row = await queryOne<ModuleRow>(
        `INSERT INTO modules (id, company_id, module_code, module_name, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, now())
         RETURNING ${MODULE_COLUMNS_SQL}`,
        [input.companyId, input.moduleCode, input.moduleName],
    );
    if (!row) throw new Error('Insert into modules returned no row');
    return row;
}

export async function existsModuleInCompany(id: string, companyId: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM modules WHERE id = $1 AND company_id = $2) AS exists', [
        id,
        companyId,
    ]);
    return row?.exists ?? false;
}

/** Narrow projection for rightService's derivation of rightName/displayName. */
export async function findModuleCodeName(id: string, companyId: string): Promise<{ moduleCode: string; moduleName: string } | null> {
    return queryOne<{ moduleCode: string; moduleName: string }>(
        'SELECT module_code AS "moduleCode", module_name AS "moduleName" FROM modules WHERE id = $1 AND company_id = $2',
        [id, companyId],
    );
}

export async function findModuleById(id: string, companyId: string): Promise<ModuleRow | null> {
    return queryOne<ModuleRow>(`SELECT ${MODULE_COLUMNS_SQL} FROM modules WHERE id = $1 AND company_id = $2`, [id, companyId]);
}

export interface ListModulesFilter {
    name?: string;
}

export async function listModules(
    companyId: string,
    filter: ListModulesFilter,
    skip: number,
    take: number,
): Promise<{ rows: ModuleRow[]; total: number }> {
    const conditions = ['company_id = $1'];
    const values: unknown[] = [companyId];
    if (filter.name) {
        values.push(`%${filter.name}%`);
        conditions.push(`module_name ILIKE $${values.length}`);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<ModuleRow>(
            `SELECT ${MODULE_COLUMNS_SQL} FROM modules ${whereSql}
             ORDER BY module_name ASC
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM modules ${whereSql}`, values);
        return { rows: rowsResult.rows, total: Number(countResult.rows[0]?.count ?? 0) };
    });
}

export interface UpdateModulePatch {
    moduleCode?: string;
    moduleName?: string;
}

export async function updateModule(id: string, patch: UpdateModulePatch): Promise<ModuleRow> {
    const columns: Record<keyof UpdateModulePatch, string> = { moduleCode: 'module_code', moduleName: 'module_name' };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(columns) as [keyof UpdateModulePatch, string][]) {
        if (patch[key] === undefined) continue;
        values.push(patch[key]);
        sets.push(`${column} = $${values.length}`);
    }
    values.push(id);
    const row = await queryOne<ModuleRow>(
        `UPDATE modules SET ${sets.length > 0 ? sets.join(', ') : 'id = id'}, updated_at = now()
         WHERE id = $${values.length}
         RETURNING ${MODULE_COLUMNS_SQL}`,
        values,
    );
    if (!row) throw new Error(`Update on modules returned no row for id ${id}`);
    return row;
}

export async function countTabsForModule(id: string): Promise<number> {
    const row = await queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM tabs WHERE module_id = $1', [id]);
    return Number(row?.count ?? 0);
}

export async function deleteModule(id: string): Promise<void> {
    await query('DELETE FROM modules WHERE id = $1', [id]);
}
