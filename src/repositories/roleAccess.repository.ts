import type pg from 'pg';
import { query, queryOne } from '../db/query.js';
import { withReadClient } from '../db/transaction.js';
import type { RightAction } from '../types/enums.js';

export interface RoleAccessRow {
    id: string;
    roleName: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    rightIds: string[];
}

const ROLE_ACCESS_SELECT_SQL = `
    SELECT ra.id, ra.role_name AS "roleName", ra.description, ra.created_at AS "createdAt", ra.updated_at AS "updatedAt",
           COALESCE(
             (SELECT array_agg(rar.right_id) FROM role_access_rights rar WHERE rar.role_access_id = ra.id),
             ARRAY[]::uuid[]
           ) AS "rightIds"
    FROM role_access ra
`;

/** Throws-free: returns 0 if `rightIds` don't all belong to this company's Rights — caller compares against expected length. */
export async function countRightsMatching(rightIds: string[], companyId: string): Promise<number> {
    if (rightIds.length === 0) return 0;
    const row = await queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM rights WHERE id = ANY($1::uuid[]) AND company_id = $2', [
        rightIds,
        companyId,
    ]);
    return Number(row?.count ?? 0);
}

export async function insertRoleAccess(
    client: pg.PoolClient,
    input: { companyId: string; roleName: string; description?: string | null },
): Promise<{ id: string }> {
    const result = await client.query<{ id: string }>(
        `INSERT INTO role_access (id, company_id, role_name, description, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, now())
         RETURNING id`,
        [input.companyId, input.roleName, input.description ?? null],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into role_access returned no row');
    return row;
}

export async function insertRoleAccessRights(client: pg.PoolClient, roleAccessId: string, rightIds: string[]): Promise<void> {
    if (rightIds.length === 0) return;
    const values: string[] = [];
    const params: unknown[] = [];
    for (const rightId of rightIds) {
        params.push(roleAccessId, rightId);
        const base = params.length - 2;
        values.push(`(gen_random_uuid(), $${base + 1}, $${base + 2}, now())`);
    }
    await client.query(`INSERT INTO role_access_rights (id, role_access_id, right_id, created_at) VALUES ${values.join(', ')}`, params);
}

export async function deleteRoleAccessRights(client: pg.PoolClient, roleAccessId: string): Promise<void> {
    await client.query('DELETE FROM role_access_rights WHERE role_access_id = $1', [roleAccessId]);
}

export async function updateRoleAccessRow(
    client: pg.PoolClient,
    id: string,
    patch: { roleName?: string; description?: string | null },
): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (patch.roleName !== undefined) {
        values.push(patch.roleName);
        sets.push(`role_name = $${values.length}`);
    }
    if (patch.description !== undefined) {
        values.push(patch.description);
        sets.push(`description = $${values.length}`);
    }
    values.push(id);
    await client.query(`UPDATE role_access SET ${sets.length > 0 ? sets.join(', ') : 'id = id'}, updated_at = now() WHERE id = $${values.length}`, values);
}

export async function findRoleAccessByIdTx(client: pg.PoolClient, id: string): Promise<RoleAccessRow> {
    const result = await client.query<RoleAccessRow>(`${ROLE_ACCESS_SELECT_SQL} WHERE ra.id = $1`, [id]);
    const row = result.rows[0];
    if (!row) throw new Error(`role_access ${id} not found after write`);
    return row;
}

export async function findRoleAccessById(id: string, companyId: string): Promise<RoleAccessRow | null> {
    return queryOne<RoleAccessRow>(`${ROLE_ACCESS_SELECT_SQL} WHERE ra.id = $1 AND ra.company_id = $2`, [id, companyId]);
}

export async function existsRoleAccessInCompany(id: string, companyId: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM role_access WHERE id = $1 AND company_id = $2) AS exists', [
        id,
        companyId,
    ]);
    return row?.exists ?? false;
}

export interface ListRoleAccessFilter {
    name?: string;
}

export async function listRoleAccesses(
    companyId: string,
    filter: ListRoleAccessFilter,
    skip: number,
    take: number,
): Promise<{ rows: RoleAccessRow[]; total: number }> {
    const conditions = ['ra.company_id = $1'];
    const values: unknown[] = [companyId];
    if (filter.name) {
        values.push(`%${filter.name}%`);
        const idx = values.length;
        conditions.push(`(ra.role_name ILIKE $${idx} OR ra.description ILIKE $${idx})`);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    return withReadClient(async (client) => {
        const rowsResult = await client.query<RoleAccessRow>(
            `${ROLE_ACCESS_SELECT_SQL} ${whereSql} ORDER BY ra.role_name ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, take, skip],
        );
        const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM role_access ra ${whereSql}`, values);
        return { rows: rowsResult.rows, total: Number(countResult.rows[0]?.count ?? 0) };
    });
}

/** RoleAccessRight rows cascade-delete; any User.roleAccessId pointing here is SetNull (schema-level FKs). */
export async function deleteRoleAccessRow(id: string): Promise<void> {
    await query('DELETE FROM role_access WHERE id = $1', [id]);
}

export interface AccessGrantRow {
    moduleCode: string;
    tabCode: string | null;
}

/** Resolves the distinct (moduleCode, tabCode) pairs a RoleAccess's rights unlock, via RoleAccessRight -> Right -> Module (+ optionally Tab). */
export async function resolveRoleAccessGrants(roleAccessId: string, companyId: string): Promise<AccessGrantRow[]> {
    const result = await query<AccessGrantRow>(
        `SELECT DISTINCT m.module_code AS "moduleCode", t.tab_code AS "tabCode"
         FROM role_access_rights rar
         JOIN rights r ON r.id = rar.right_id
         JOIN modules m ON m.id = r.module_id
         LEFT JOIN tabs t ON t.id = r.tab_id
         WHERE rar.role_access_id = $1 AND r.company_id = $2`,
        [roleAccessId, companyId],
    );
    return result.rows;
}

/** Resolves just the rightName strings a RoleAccess grants — the raw list backing UserAccess.rights. */
export async function resolveRoleAccessRightNames(roleAccessId: string, companyId: string): Promise<string[]> {
    const result = await query<{ rightName: string }>(
        `SELECT r.right_name AS "rightName"
         FROM role_access_rights rar
         JOIN rights r ON r.id = rar.right_id
         WHERE rar.role_access_id = $1 AND r.company_id = $2`,
        [roleAccessId, companyId],
    );
    return result.rows.map((row) => row.rightName);
}

export async function findUserRoleAccessId(userId: string, companyId: string): Promise<string | null> {
    const row = await queryOne<{ roleAccessId: string | null }>('SELECT role_access_id AS "roleAccessId" FROM users WHERE id = $1 AND company_id = $2', [
        userId,
        companyId,
    ]);
    return row ? row.roleAccessId : null;
}

/**
 * Whether `roleAccessId` includes a right granting `action` on `moduleCode` — optionally scoped to
 * `tabCode` (matches a right scoped to that exact tab OR one scoped to the whole module, tab_id null).
 */
export async function existsRoleAccessRightMatch(
    roleAccessId: string,
    companyId: string,
    moduleCode: string,
    action: RightAction,
    tabCode?: string,
): Promise<boolean> {
    const values: unknown[] = [roleAccessId, companyId, moduleCode, action];
    let tabCondition = '';
    if (tabCode) {
        values.push(tabCode);
        tabCondition = `AND (t.tab_code = $${values.length} OR r.tab_id IS NULL)`;
    }
    const row = await queryOne<{ exists: boolean }>(
        `SELECT EXISTS(
            SELECT 1
            FROM role_access_rights rar
            JOIN rights r ON r.id = rar.right_id
            JOIN modules m ON m.id = r.module_id
            LEFT JOIN tabs t ON t.id = r.tab_id
            WHERE rar.role_access_id = $1 AND r.company_id = $2 AND r.action = $4 AND m.module_code = $3
            ${tabCondition}
         ) AS exists`,
        values,
    );
    return row?.exists ?? false;
}

export async function countUsersMatching(ids: string[], companyId: string): Promise<number> {
    if (ids.length === 0) return 0;
    const row = await queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM users WHERE id = ANY($1::uuid[]) AND company_id = $2', [
        ids,
        companyId,
    ]);
    return Number(row?.count ?? 0);
}

export async function bulkAssignRoleAccessToUsers(ids: string[], companyId: string, roleAccessId: string): Promise<void> {
    await query('UPDATE users SET role_access_id = $1 WHERE id = ANY($2::uuid[]) AND company_id = $3', [roleAccessId, ids, companyId]);
}
