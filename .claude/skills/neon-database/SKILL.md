# Neon Database Skill

## Purpose
Production-safe PostgreSQL usage with Neon.

## Connection management
Use environment-based configuration. Never commit credentials.

Use the connection strategy established by the project for Prisma + Neon. Do not create a second database architecture without reason.

Reuse the application's Prisma client rather than creating PrismaClient per request.

## Environments
Keep development, test and production databases isolated.

Never run destructive reset operations against production.

## Schema changes
Use Prisma migrations.

Before production migration:
1. inspect schema
2. understand existing data
3. review constraints/indexes
4. assess locking/duration
5. test migration
6. plan recovery

## Performance
For slow queries:
- inspect execution plans
- review indexes
- reduce selected columns
- reduce relation loading
- paginate
- aggregate in PostgreSQL
- inspect query/connection behavior

Prefer query/index optimization before adding Redis/cache.

## Production safety
Never solve development problems by resetting or recreating production data.

## Secrets
Never log DATABASE_URL or database credentials.
