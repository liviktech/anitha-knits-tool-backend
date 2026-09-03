import type pg from 'pg';
import { pool } from './pool.js';

/**
 * Runs `fn` inside a single BEGIN/COMMIT transaction on one dedicated client, rolling back on any
 * throw. This is the direct replacement for every Prisma `$transaction` (both array-form and
 * interactive-callback-form): every function that used to take a `Prisma.TransactionClient` now
 * takes a `pg.PoolClient` instead, and must route every query for that unit of work through it
 * (never `pool.query` directly) so they share the same transaction.
 */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Runs `fn` on one dedicated (but non-transactional) client — the replacement for Prisma's
 * array-form `$transaction([findMany, count])` pagination pairs, which never needed rollback
 * semantics, just both queries sharing one connection for a consistent snapshot.
 */
export async function withReadClient<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
        return await fn(client);
    } finally {
        client.release();
    }
}
