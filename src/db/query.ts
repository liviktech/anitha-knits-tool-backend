import type pg from 'pg';
import { pool } from './pool.js';
import { logger } from '../utils/logger.js';

export type Queryable = Pick<pg.Pool | pg.PoolClient, 'query'>;

/** Runs a parameterized query against the pool (or, inside a transaction, pass `client` instead). */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
    executor: Queryable = pool,
): Promise<pg.QueryResult<T>> {
    const start = Date.now();
    const result = await executor.query<T>(text, params);
    const durationMs = Date.now() - start;
    logger.debug(`query executed in ${durationMs}ms: ${text}`);
    return result;
}

/** Same as `query`, but returns the first row (or `null`) instead of the full result set. */
export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
    executor: Queryable = pool,
): Promise<T | null> {
    const result = await query<T>(text, params, executor);
    return result.rows[0] ?? null;
}
