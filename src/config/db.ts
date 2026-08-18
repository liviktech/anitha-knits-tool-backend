import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    ssl: true,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
    logger.error('Unexpected error on idle Postgres client', err);
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
): Promise<pg.QueryResult<T>> {
    const start = Date.now();
    const result = await pool.query<T>(text, params);
    const durationMs = Date.now() - start;
    logger.debug(`query executed in ${durationMs}ms: ${text}`);
    return result;
}
