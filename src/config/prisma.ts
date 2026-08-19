import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { pool } from './db.js';

// Reuses the app's single pg.Pool (config/db.ts) instead of letting Prisma
// open a second connection pool to the same database.
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
