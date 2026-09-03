import type pg from 'pg';
import { query, queryOne } from '../db/query.js';
import { withReadClient } from '../db/transaction.js';

export interface TabRow {
    id: string;
    moduleId: string;
    tabCode: string;
    tabName: string;
    createdAt: Date;
    updatedAt: Date;
    moduleName: string;
}

const TAB_SELECT_SQL = `
    SELECT t.id, t.module_id AS "moduleId", t.tab_code AS "tabCode", t.tab_name AS "tabName",
           t.created_at AS "createdAt", t.updated_at AS "updatedAt", m.module_name AS "moduleName"
    FROM tabs t
    JOIN modules m ON m.id = t.module_id
`;

/** Bulk-inserts Tab rows for one module — used by authService.signupCompany's default-catalog seeding. No-op if `tabs` is empty. */
export async function insertTabs(
    client: pg.PoolClient,
    companyId: string,
    moduleId: string,
    tabs: { code: string; name: string }[],
): Promise<void> {
    if (tabs.length === 0) return;
    const values: string[] = [];
    const params: unknown[] = [];
    for (const tab of tabs) {
        params.push(companyId, moduleId, tab.code, tab.name);
        const base = params.length - 4;
        values.push(`(gen_random_uuid(), $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, now())`);
    }
    await client.query(`INSERT INTO tabs (id, company_id, module_id, tab_code, tab_name, updated_at) VALUES ${values.join(', ')}`, params);
}

export async function createTab(input: { companyId: string; moduleId: string; tabCode: string; tabName: string }): Promise<TabRow> {
    const row = await queryOne<TabRow>(
        `WITH inserted AS (
            INSERT INTO tabs (id, company_id, module_id, tab_code, tab_name, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, now())
            RETURNING *
         )
         SELECT i.id, i.module_id AS "moduleId", i.tab_code AS "tabCode", i.tab_name AS "tabName",
                i.created_at AS "createdAt", i.updated_at AS "updatedAt", m.module_name AS "moduleName"
         FROM inserted i JOIN modules m ON m.id = i.module_id`,
        [input.companyId, input.moduleId, input.tabCode, input.tabName],
    );
    if (!row) throw new Error('Insert into tabs returned no row');
    return row;
}

export async function existsTabInCompany(id: string, companyId: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM tabs WHERE id = $1 AND company_id = $2) AS exists', [
        id,
        companyId,
    ]);
    return row?.exists ?? false;
}

/** Narrow projection for rightService's derivation of rightName/displayName. */
export async function findTabForDerivation(id: string, companyId: string): Promise<{ moduleId: string; tabCode: string; tabName: string } | null> {
    return queryOne<{ moduleId: string; tabCode: string; tabName: string }>(
        'SELECT module_id AS "moduleId", tab_code AS "tabCode", tab_name AS "tabName" FROM tabs WHERE id = $1 AND company_id = $2',
        [id, companyId],
    );
}

export async function findTabById(id: string, companyId: string): Promise<TabRow | null> {
    return queryOne<TabRow>(`${TAB_SELECT_SQL} WHERE t.id = $1 AND t.company_id = $2`, [id, companyId]);
}

export interface ListTabsFilter {
    moduleId?: string;
    name?: string;
}

export async function listTabs(companyId: string, filter: ListTabsFilter, skip: number, take: number): Promise<{ rows: TabRow[]; total: number }> {
    const conditions = ['t.company_id = $1'];
    const values: unknown[] = [companyId];
    if (filter.moduleId) {
        values.push(filter.moduleId);
        conditions.push(`t.module_id = $${values.length}`);
    }
    if (filter.name) {
        values.push(`%${filter.name}%`);
        conditions.push(`t.tab_name ILIKE $${values.length}`);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<TabRow>(
            `${TAB_SELECT_SQL} ${whereSql} ORDER BY t.tab_name ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tabs t ${whereSql}`, values);
        return { rows: rowsResult.rows, total: Number(countResult.rows[0]?.count ?? 0) };
    });
}

export interface UpdateTabPatch {
    moduleId?: string;
    tabCode?: string;
    tabName?: string;
}

export async function updateTab(id: string, patch: UpdateTabPatch): Promise<TabRow> {
    const columns: Record<keyof UpdateTabPatch, string> = { moduleId: 'module_id', tabCode: 'tab_code', tabName: 'tab_name' };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(columns) as [keyof UpdateTabPatch, string][]) {
        if (patch[key] === undefined) continue;
        values.push(patch[key]);
        sets.push(`${column} = $${values.length}`);
    }
    values.push(id);
    const row = await queryOne<TabRow>(
        `WITH updated AS (
            UPDATE tabs SET ${sets.length > 0 ? sets.join(', ') : 'id = id'}, updated_at = now()
            WHERE id = $${values.length}
            RETURNING *
         )
         SELECT u.id, u.module_id AS "moduleId", u.tab_code AS "tabCode", u.tab_name AS "tabName",
                u.created_at AS "createdAt", u.updated_at AS "updatedAt", m.module_name AS "moduleName"
         FROM updated u JOIN modules m ON m.id = u.module_id`,
        values,
    );
    if (!row) throw new Error(`Update on tabs returned no row for id ${id}`);
    return row;
}

export async function countRightsForTab(id: string): Promise<number> {
    const row = await queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM rights WHERE tab_id = $1', [id]);
    return Number(row?.count ?? 0);
}

export async function deleteTab(id: string): Promise<void> {
    await query('DELETE FROM tabs WHERE id = $1', [id]);
}
