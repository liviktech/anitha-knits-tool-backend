# Database migrations

This replaces Prisma Migrate as the project's migration history.

## `migrations/0001_baseline.sql`

A schema-only `pg_dump` of the **production** database, captured 2026-09-03. This is the
authoritative starting point going forward — **do not run it against production**, it already
has this schema. It exists so a fresh environment (a new dev branch, CI, etc.) can be bootstrapped
with `psql "$DATABASE_URL" -f database/migrations/0001_baseline.sql`.

It replaces (does not extend) the old `src/prisma/migrations/` history, which had drifted from
the live schema — the recorded Prisma migrations still created `production_settings`/
`approval_events` tables and single-column unique indexes (`brands.name`, etc.) that haven't
existed on production for some time, meaning schema changes were applied at some point outside
Prisma's own migration tracking (most likely `prisma db push`). Rather than propagate that
inaccurate history, this baseline was generated directly from the live, verified production
schema via `pg_dump --schema-only`, cross-checked column-by-column against `schema.prisma` before
Prisma was removed.

Excludes: `_prisma_migrations` (Prisma bookkeeping, no longer relevant) and six `platform_*`
tables (`platform_modules`, `platform_tabs`, `platform_rights`, `platform_role_access`,
`platform_role_access_rights`, `platform_employee_access`) that live in the same database but
belong to a separate, unrelated internal tool — not part of this application's schema. Note that
`platform_admins` (this app's own platform-admin table) *is* included; only the six others are excluded.

## Applying migrations

`src/scripts/migrate.ts` (no ORM, no external migration library — just the app's own `pg` Pool)
tracks applied files in a `schema_migrations` table and runs whatever's pending, in filename order,
each inside its own transaction:

```bash
npm run migrate            # apply every not-yet-applied migration
```

A database that already has a migration's end-state schema (this was the case for dev and
production immediately after `0001_baseline.sql` was generated *from* them) needs to be told that
without re-running the DDL:

```bash
npm run migrate:baseline   # marks pending migrations as applied WITHOUT executing them
```

Both dev and production were baselined against `0001_baseline.sql` on 2026-09-03. Any *new*
environment (CI, a fresh branch) should run `npm run migrate` instead, which will execute
`0001_baseline.sql` for real and create the schema from nothing (verified: it does, cleanly, in an
isolated schema).

**Pooled-connection gotcha**: `pg_dump` emits `SELECT pg_catalog.set_config('search_path', '', false)`,
a *session-level* (non-transactional) change. Through a connection pooler (Neon's, and RDS Proxy in
the eventual Lambda deployment), that can leak into a later, unrelated query on the same backend
connection — reproduced empirically while building this runner. `migrate.ts` runs `DISCARD ALL`
both right after connecting and before releasing the connection back to the pool specifically to
guard against this; keep that pattern in any future script that runs raw `pg_dump` output through a
pooled connection.

## Future migrations

Add new files here as `0002_<description>.sql`, `0003_<description>.sql`, etc. — plain SQL, applied
in order by `npm run migrate`.

## Seed data

There's no static global seed file. Master data (brands/chemicals/sizes/colors, a default colour
consumption standard, wastage types, and the default module/tab access-control catalog) is
seeded **per company** at signup time by `src/services/masterDataSeedService.ts` (called from
`authService.signupCompany`). `src/prisma/seed.ts` (despite the legacy path) is a standalone
`pg`-based CLI backfill script for companies that existed before that automatic seeding was added —
run it with `SEED_COMPANY_ID=<company-id> npm run seed:demo`.
