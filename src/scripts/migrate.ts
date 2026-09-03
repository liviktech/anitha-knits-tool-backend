/**
 * scripts/migrate.ts — applies database/migrations/*.sql files in filename order, tracking
 * what's already been applied in a `schema_migrations` table. No ORM, no external migration
 * library — just the same `pg` Pool the app uses.
 *
 * Usage:
 *   npm run migrate              — apply every not-yet-applied migration
 *   npm run migrate:baseline     — mark every not-yet-applied migration as applied WITHOUT
 *                                  running it (for a database that already has that schema —
 *                                  e.g. dev/production right after 0001_baseline.sql was
 *                                  generated FROM them via pg_dump)
 */
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import type pg from 'pg';
import { pool } from '../db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');

/** pg_dump (18+) prefixes/suffixes its output with `\restrict`/`\unrestrict` — psql-only meta-commands, not valid SQL for a driver to execute. Strip any backslash-command line before running a file. */
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
 * pg_dump emits `SELECT pg_catalog.set_config('search_path', '', false)` — a *session-level*
 * (non-transactional; the `false` means "not local to this transaction") change. On a pooled
 * connection that persists past this script and can leak into a completely unrelated later
 * query on the same physical backend connection (confirmed empirically against Neon's pooler;
 * the same risk applies to RDS Proxy). `DISCARD ALL` resets search_path and all other session
 * state back to defaults — run it both defensively on connect (in case a previous pool user left
 * something dirty) and before releasing the connection back to the pool.
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
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);

        const appliedResult = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
        const applied = new Set(appliedResult.rows.map((row) => row.name));

        const pending = listMigrationFiles().filter((file) => !applied.has(file));

        if (pending.length === 0) {
            console.log('No pending migrations.');
            return;
        }

        for (const file of pending) {
            if (baselineOnly) {
                await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
                console.log(`Baselined ${file} (marked applied, not executed)`);
                continue;
            }

            const sql = stripPsqlMetaCommands(readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));

            console.log(`Applying ${file}...`);
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
                await client.query('COMMIT');
                console.log(`Applied ${file}`);
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                // BEGIN/COMMIT/ROLLBACK don't scope session-level GUC changes (see resetSession above) —
                // the migration file's own SET/set_config statements persist regardless, so reset explicitly.
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
