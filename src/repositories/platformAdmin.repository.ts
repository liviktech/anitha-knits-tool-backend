import { query, queryOne } from '../db/query.js';
import type { PlatformAdminRole } from '../types/enums.js';

export interface PlatformAdminRow {
    id: string;
    name: string;
    mobile: string;
    role: PlatformAdminRole;
    isActive: boolean;
    createdAt: Date;
}

export interface PlatformAdminWithPasswordRow extends PlatformAdminRow {
    passwordHash: string;
}

export async function countPlatformAdmins(): Promise<number> {
    const result = await queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM platform_admins');
    return Number(result?.count ?? 0);
}

export async function createPlatformAdmin(input: {
    name: string;
    mobile: string;
    passwordHash: string;
}): Promise<PlatformAdminRow> {
    const row = await queryOne<PlatformAdminRow>(
        `INSERT INTO platform_admins (id, name, mobile, password_hash, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, now())
         RETURNING id, name, mobile, role, is_active AS "isActive", created_at AS "createdAt"`,
        [input.name, input.mobile, input.passwordHash],
    );
    if (!row) throw new Error('Insert into platform_admins returned no row');
    return row;
}

export async function findPlatformAdminByMobile(mobile: string): Promise<PlatformAdminWithPasswordRow | null> {
    return queryOne<PlatformAdminWithPasswordRow>(
        `SELECT id, name, mobile, role, is_active AS "isActive", created_at AS "createdAt", password_hash AS "passwordHash"
         FROM platform_admins
         WHERE mobile = $1`,
        [mobile],
    );
}

export async function findPlatformAdminById(id: string): Promise<PlatformAdminRow | null> {
    return queryOne<PlatformAdminRow>(
        `SELECT id, name, mobile, role, is_active AS "isActive", created_at AS "createdAt"
         FROM platform_admins
         WHERE id = $1`,
        [id],
    );
}

/** Sets a freshly-hashed password (forgot-password flow) — never accepts a plaintext value. */
export async function updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await query('UPDATE platform_admins SET password_hash = $1, updated_at = now() WHERE id = $2', [passwordHash, id]);
}
