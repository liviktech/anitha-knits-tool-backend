import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { prisma } from './config/prisma.js';
import { logger } from './utils/logger.js';

const server = app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT} [${env.NODE_ENV}]`);
});

async function shutdown(signal: string): Promise<void> {
    logger.info(`${signal} received, shutting down gracefully...`);

    server.close(async (err) => {
        if (err) {
            logger.error('Error while closing HTTP server', err);
            process.exitCode = 1;
        }

        try {
            await pool.end();
            logger.info('Database pool closed');
        } catch (poolErr) {
            logger.error('Error while closing database pool', poolErr);
            process.exitCode = 1;
        }

        try {
            await prisma.$disconnect();
            logger.info('Prisma client disconnected');
        } catch (prismaErr) {
            logger.error('Error while disconnecting Prisma client', prismaErr);
            process.exitCode = 1;
        }

        process.exit();
    });

    // Force-exit if graceful shutdown hangs
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err);
    process.exit(1);
});
