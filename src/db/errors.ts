/**
 * Native Postgres error shape (node-postgres throws plain Error objects annotated with these
 * fields for backend errors — see https://www.postgresql.org/docs/current/errcodes-appendix.html).
 * This replaces Prisma's `PrismaClientKnownRequestError`/`P2002`/`meta.target` error mapping.
 */
export interface PgDatabaseError extends Error {
    code?: string;
    constraint?: string;
    detail?: string;
    table?: string;
    column?: string;
}

function isPgDatabaseError(err: unknown): err is PgDatabaseError {
    return err instanceof Error && typeof (err as PgDatabaseError).code === 'string';
}

/** 23505 — a UNIQUE (or PRIMARY KEY) constraint was violated. */
export function isUniqueViolation(err: unknown): err is PgDatabaseError {
    return isPgDatabaseError(err) && err.code === '23505';
}

/** 23503 — a FOREIGN KEY constraint was violated (referenced row missing, or still referenced on delete). */
export function isForeignKeyViolation(err: unknown): err is PgDatabaseError {
    return isPgDatabaseError(err) && err.code === '23503';
}

/** 23502 — a NOT NULL constraint was violated. */
export function isNotNullViolation(err: unknown): err is PgDatabaseError {
    return isPgDatabaseError(err) && err.code === '23502';
}

/** The exact unique/foreign-key/etc. constraint name Postgres reports, e.g. "companies_gst_key". */
export function getConstraintName(err: unknown): string | undefined {
    return isPgDatabaseError(err) ? err.constraint : undefined;
}
