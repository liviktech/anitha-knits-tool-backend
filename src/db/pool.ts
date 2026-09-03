import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// NUMERIC/DECIMAL (OID 1700) comes back from `pg` as a string by default, to avoid silent precision
// loss. Every existing call site in this codebase already does its own `Number(...)`/`.toNumber()`
// conversion at the service layer, so parsing numerics to JS numbers here reproduces that behavior
// globally without touching each call site individually.
pg.types.setTypeParser(1700, (value) => parseFloat(value));

export const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    ssl: true,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
});

pool.on('error', (err) => {
    logger.error('Unexpected error on idle Postgres client', err);
});
