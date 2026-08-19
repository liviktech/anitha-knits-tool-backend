# Database Migrations Skill

## Purpose
Safe Prisma/PostgreSQL schema evolution.

## Rules
Every schema change requires a Prisma migration.

Before migration:
1. inspect current schema
2. inspect existing data
3. understand dependencies
4. review constraints/indexes
5. identify backfill needs
6. assess lock/duration
7. test

## Production safety
Never:
- use `prisma migrate reset` in production
- delete/recreate production data
- bypass controlled migrations casually

## Design
Prefer:
- small migrations
- backward-compatible phased changes where needed
- safe defaults
- explicit backfills
- reversible steps where practical

For large tables:
- avoid long blocking operations
- consider phased rollout
- backfill in batches
- use production-safe index strategies

## Historical data
Do not destroy historical production information.

When changing historical definitions consider:
- versioning
- snapshots
- adjustments
- backfill strategy

## Prisma
After schema changes:
- validate/generate as appropriate
- inspect migration SQL for important changes
- run relevant tests
- verify affected queries

## Risky rollout
For risky changes:
1. additive schema
2. compatible application code
3. backfill
4. verify
5. remove obsolete structure later

Document operational concerns for high-risk migrations.
