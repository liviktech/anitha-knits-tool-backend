# Database migrations

This replaces Prisma Migrate as the project's migration history. No ORM, no external migration
library — plain, hand-written SQL files and a small runner (`src/scripts/migrate.ts`) built on the
app's own `pg` Pool, organized the same way as the reference migration set at
`../../docs/migrations`: one `000_migration_history.sql` tracking-table file first, then a run of
numbered, feature-grouped files with `CREATE TABLE IF NOT EXISTS`, inline constraints, and indexes
collected at the bottom of each file.

## The migration files

| File | Contents |
|---|---|
| `000_migration_history.sql` | The `migration_history` tracking table itself — always runs first. |
| `001_enum_types.sql` | Every `CREATE TYPE ... AS ENUM` — must precede any table that uses one as a column type. |
| `002_companies_and_platform_admins.sql` | `companies` (the tenancy root) and `platform_admins` (the separate, company-independent operator table). |
| `003_master_data.sql` | `brands`, `chemicals`, `colors`, `sizes`, `color_consumption_standards`. |
| `004_access_control.sql` | `role_access`, `modules`, `tabs`, `rights`, `role_access_rights` — `role_access` is created here (not with `users`) because `users.role_access_id` references it. |
| `005_users_and_employees.sql` | `users`, `employee_details`. |
| `006_production.sql` | `production_records` + its per-stage detail tables (`extruder_details`, `loom_details`, `fabric_check_details`), plus `wastage_types`/`wastage_records`. |
| `007_kora_balance.sql` | `kora_balances`, `kora_ledger_entries`. |
| `008_inventory_and_load_sent.sql` | `inventory`, `load_sent`. |
| `009_hr_and_payroll.sql` | `attendances`, `expenses`, `market_value_distributions`, `market_value_allocations`, `salary_advances`, `payroll_records`. |

Files are ordered so every `REFERENCES` target already exists by the time it's needed — verified
by actually running all ten, in order, in an isolated throwaway schema (created and dropped,
nothing real touched) and diffing the result against the live database column-by-column (300/300
columns), index-by-index (114/114), and FK-by-FK (54/54) — all identical. Every table/column name,
type, default, nullability, and constraint name matches the live schema exactly (Postgres's default
constraint-naming — `<table>_pkey`, `<table>_<col>_key`, `<table>_<col>_fkey` — reproduces the
existing names automatically as long as constraints stay inline and unnamed, which is what these
files do throughout).

This set replaced an earlier single `0001_baseline.sql` (a raw `pg_dump --schema-only` of
production) that worked but wasn't hand-readable. It in turn replaced the old
`src/prisma/migrations/` history, which had drifted from the live schema — the recorded Prisma
migrations still created `production_settings`/`approval_events` tables and single-column unique
indexes that haven't existed on production for some time, meaning schema changes were applied at
some point outside Prisma's own migration tracking (most likely `prisma db push`).

Not included: the six `platform_*` tables (`platform_modules`, `platform_tabs`, `platform_rights`,
`platform_role_access`, `platform_role_access_rights`, `platform_employee_access`) that live in the
same database but belong to a separate, unrelated internal tool — not part of this application.
`platform_admins` (this app's own platform-admin table) *is* included; only those six are excluded.

## Applying migrations

```bash
npm run migrate            # apply every not-yet-applied migration, each in its own transaction
```

A database that already has a migration's end-state schema (this was the case for dev and
production, immediately after these files were written *from* their live schema) needs to be told
that without re-running the DDL:

```bash
npm run migrate:baseline   # marks pending migrations as applied WITHOUT executing them
```

Both dev and production were baselined against `000`-`009` on 2026-09-03 (dev additionally had a
few stray leftovers reconciled first — three unused `inventory` unique indexes not present on
production, dropped; one `inventory` index production has that dev was missing, added — see
`anitha_knits_prisma_pg_migration` memory for the full account). Any *new* environment (CI, a
fresh branch) should run `npm run migrate` instead, which executes all ten files for real and
creates the schema from nothing.

**Pooled-connection gotcha**: a migration file that changes session-level state non-transactionally
(the classic example is `pg_dump`'s `SELECT pg_catalog.set_config('search_path', '', false)` — none
of the current files do this, but a future one might if content is ever pasted in from `pg_dump`
output) can leak that state into a later, unrelated query on the same pooled backend connection —
reproduced empirically against Neon's pooler while building this runner; the same risk applies to
RDS Proxy in the eventual Lambda deployment. `migrate.ts` runs `DISCARD ALL` both right after
connecting and before releasing the connection back to the pool specifically to guard against this.

## Future migrations

Add new files here as `010_<description>.sql`, `011_<description>.sql`, etc. — plain SQL, applied
in order by `npm run migrate`. Match the existing style: `CREATE TABLE IF NOT EXISTS`, constraints
inline (unnamed, so Postgres's default naming stays predictable), a short header comment block,
indexes collected at the bottom of the file.

## Seed data

There's no static global seed file. Master data (brands/chemicals/sizes/colors, a default colour
consumption standard, wastage types, and the default module/tab access-control catalog) is
seeded **per company** at signup time by `src/services/masterDataSeedService.ts` (called from
`authService.signupCompany`). `src/scripts/seed.ts` is a standalone `pg`-based CLI backfill script
for companies that existed before that automatic seeding was added — run it with
`SEED_COMPANY_ID=<company-id> npm run seed:demo`.
