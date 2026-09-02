import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// A second, independent pool — this points at the Livik internal tool's own database, entirely
// separate from this app's `pool` (config/db.ts). Read-only usage only (see livikEmployeeService.ts).
export const livikPool = new pg.Pool({
    connectionString: env.LIVIK_DATABASE_URL,
    ssl: true,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

livikPool.on('error', (err) => {
    logger.error('Unexpected error on idle Livik Postgres client', err);
});
