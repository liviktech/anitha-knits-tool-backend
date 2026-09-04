import type pg from 'pg';
import { query, queryOne } from '../db/query.js';
import { withReadClient } from '../db/transaction.js';
import type { RightAction } from '../types/enums.js';

export interface RightRow {
    id: string;
    moduleId: string;
    tabId: string | null;
    action: RightAction;
    rightName: string;
    displayName: string;
    createdAt: Date;
    updatedAt: Date;
    moduleName: string;
    tabName: string | null;
}

const RIGHT_SELECT_SQL = `
    SELECT r.id, r.module_id AS "moduleId", r.tab_id AS "tabId", r.action, r.right_name AS "rightName",
           r.display_name AS "displayName", r.created_at AS "createdAt", r.updated_at AS "updatedAt",
           m.module_name AS "moduleName", t.tab_name AS "tabName"
    FROM rights r
    JOIN modules m ON m.id = r.module_id
    LEFT JOIN tabs t ON t.id = r.tab_id
`;

export async function createRight(input: {
    companyId: string;
    moduleId: string;
    tabId: string | null;
    action: RightAction;
    rightName: string;
    displayName: string;
}): Promise<RightRow> {
    const row = await queryOne<RightRow>(
        `WITH inserted AS (
            INSERT INTO rights (id, company_id, module_id, tab_id, action, right_name, display_name, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())
            RETURNING *
         )
         SELECT i.id, i.module_id AS "moduleId", i.tab_id AS "tabId", i.action, i.right_name AS "rightName",
                i.display_name AS "displayName", i.created_at AS "createdAt", i.updated_at AS "updatedAt",
                m.module_name AS "moduleName", t.tab_name AS "tabName"
         FROM inserted i
         JOIN modules m ON m.id = i.module_id
         LEFT JOIN tabs t ON t.id = i.tab_id`,
        [input.companyId, input.moduleId, input.tabId, input.action, input.rightName, input.displayName],
    );
    if (!row) throw new Error('Insert into rights returned no row');
    return row;
}

/** Transaction-scoped insert — used by authService.signupCompany's default-catalog seeding (needs only the id back). Mirrors module.repository.ts's insertModule. */
export async function insertRight(
    client: pg.PoolClient,
    input: { companyId: string; moduleId: string; tabId: string | null; action: RightAction; rightName: string; displayName: string },
): Promise<{ id: string }> {
    const result = await client.query<{ id: string }>(
        `INSERT INTO rights (id, company_id, module_id, tab_id, action, right_name, display_name, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())
         RETURNING id`,
        [input.companyId, input.moduleId, input.tabId, input.action, input.rightName, input.displayName],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into rights returned no row');
    return row;
}

export interface ListRightsFilter {
    tabId?: string;
    moduleId?: string;
    action?: RightAction;
    name?: string;
}

export async function listRights(
    companyId: string,
    filter: ListRightsFilter,
    skip: number,
    take: number,
): Promise<{ rows: RightRow[]; total: number }> {
    const conditions = ['r.company_id = $1'];
    const values: unknown[] = [companyId];
    if (filter.tabId) {
        values.push(filter.tabId);
        conditions.push(`r.tab_id = $${values.length}`);
    }
    if (filter.moduleId) {
        values.push(filter.moduleId);
        conditions.push(`r.module_id = $${values.length}`);
    }
    if (filter.action) {
        values.push(filter.action);
        conditions.push(`r.action = $${values.length}`);
    }
    if (filter.name) {
        values.push(`%${filter.name}%`);
        const idx = values.length;
        conditions.push(`(r.display_name ILIKE $${idx} OR r.right_name ILIKE $${idx})`);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<RightRow>(
            `${RIGHT_SELECT_SQL} ${whereSql} ORDER BY r.display_name ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM rights r ${whereSql}`, values);
        return { rows: rowsResult.rows, total: Number(countResult.rows[0]?.count ?? 0) };
    });
}

export async function findRightById(id: string, companyId: string): Promise<RightRow | null> {
    return queryOne<RightRow>(`${RIGHT_SELECT_SQL} WHERE r.id = $1 AND r.company_id = $2`, [id, companyId]);
}

export interface RightCoreRow {
    id: string;
    moduleId: string;
    tabId: string | null;
    action: RightAction;
}

export async function findRightCore(id: string, companyId: string): Promise<RightCoreRow | null> {
    return queryOne<RightCoreRow>(
        'SELECT id, module_id AS "moduleId", tab_id AS "tabId", action FROM rights WHERE id = $1 AND company_id = $2',
        [id, companyId],
    );
}

export async function updateRight(
    id: string,
    input: { moduleId: string; tabId: string | null; action: RightAction; rightName: string; displayName: string },
): Promise<RightRow> {
    const row = await queryOne<RightRow>(
        `WITH updated AS (
            UPDATE rights SET module_id = $1, tab_id = $2, action = $3, right_name = $4, display_name = $5, updated_at = now()
            WHERE id = $6
            RETURNING *
         )
         SELECT u.id, u.module_id AS "moduleId", u.tab_id AS "tabId", u.action, u.right_name AS "rightName",
                u.display_name AS "displayName", u.created_at AS "createdAt", u.updated_at AS "updatedAt",
                m.module_name AS "moduleName", t.tab_name AS "tabName"
         FROM updated u
         JOIN modules m ON m.id = u.module_id
         LEFT JOIN tabs t ON t.id = u.tab_id`,
        [input.moduleId, input.tabId, input.action, input.rightName, input.displayName, id],
    );
    if (!row) throw new Error(`Update on rights returned no row for id ${id}`);
    return row;
}

export async function existsRightInCompany(id: string, companyId: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM rights WHERE id = $1 AND company_id = $2) AS exists', [
        id,
        companyId,
    ]);
    return row?.exists ?? false;
}

/** RoleAccessRight rows for this right cascade-delete (FK ON DELETE CASCADE), so it's automatically removed from every role it was assigned to. */
export async function deleteRight(id: string): Promise<void> {
    await query('DELETE FROM rights WHERE id = $1', [id]);
}
