/**
 * scripts/migrate.ts — applies database/migrations/*.sql files in filename order, tracking
 * what's already been applied in a `migration_history` table. No ORM, no external migration
 * library — just the same `pg` Pool the app uses.
 *
 * Usage:
 *   npm run migrate              — apply every not-yet-applied migration
 *   npm run migrate:baseline     — mark every not-yet-applied migration as applied WITHOUT
 *                                  running it (for a database that already has that schema —
 *                                  e.g. dev/production, both baselined against 000-009 on
 *                                  2026-09-03 right after those files were written)
 */
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import type pg from 'pg';
import { pool } from '../db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');

/** Defensive: strips any psql-only backslash meta-command line (e.g. `\restrict`/`\unrestrict`, which pg_dump 18+ emits) — not valid SQL for a driver to execute, in case a future migration file is pasted in from pg_dump output. */
function stripPsqlMetaCommands(sql: string): string {
    return sql
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('\\'))
        .join('\n');
}

function listMigrationFiles(): string[] {
    return readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();
}

/**
 * Defensive: a migration file that changes session-level state non-transactionally (e.g.
 * pg_dump's `SELECT pg_catalog.set_config('search_path', '', false)`) can leak that state into a
 * later, unrelated query on the same pooled backend connection — reproduced empirically against
 * Neon's pooler while building this runner; the same risk applies to RDS Proxy. `DISCARD ALL`
 * resets search_path and all other session state back to defaults; run it both on connect (in
 * case a previous pool user left something dirty) and before releasing the connection.
 */
async function resetSession(client: pg.PoolClient): Promise<void> {
    await client.query('DISCARD ALL');
}

async function main() {
    const baselineOnly = process.argv.includes('--baseline-only');
    const client = await pool.connect();
    await resetSession(client);

    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS migration_history (
                id         SERIAL PRIMARY KEY,
                filename   VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        const appliedResult = await client.query<{ filename: string }>('SELECT filename FROM migration_history');
        const applied = new Set(appliedResult.rows.map((row) => row.filename));

        const pending = listMigrationFiles().filter((file) => !applied.has(file));

        if (pending.length === 0) {
            console.log('No pending migrations.');
            return;
        }

        for (const file of pending) {
            if (baselineOnly) {
                await client.query('INSERT INTO migration_history (filename) VALUES ($1)', [file]);
                console.log(`Baselined ${file} (marked applied, not executed)`);
                continue;
            }

            const sql = stripPsqlMetaCommands(readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));

            console.log(`Applying ${file}...`);
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO migration_history (filename) VALUES ($1)', [file]);
                await client.query('COMMIT');
                console.log(`Applied ${file}`);
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                // BEGIN/COMMIT/ROLLBACK don't scope session-level GUC changes (see resetSession above) —
                // a migration file's own SET/set_config statements persist regardless, so reset explicitly.
                await resetSession(client);
            }
        }
    } finally {
        await resetSession(client).catch(() => {});
        client.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
