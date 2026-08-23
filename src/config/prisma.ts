import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { pool } from './db.js';

// Reuses the app's single pg.Pool (config/db.ts) instead of letting Prisma
// open a second connection pool to the same database.
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
    adapter,
    // Neon (free/dev tier) suspends its compute after inactivity and takes a
    // few seconds to resume on the next query. Prisma's $transaction default
    // (maxWait 2s to acquire a connection, timeout 5s for the transaction
    // body) is too tight for that cold start and fails with P2028 ("Unable
    // to start a transaction in the given time") even though the query would
    // have succeeded a moment later. These are generous enough to ride out a
    // cold start without masking a genuinely hung query.
    transactionOptions: {
        maxWait: 10_000,
        timeout: 20_000,
    },
});
