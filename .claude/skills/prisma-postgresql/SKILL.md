# Prisma + PostgreSQL Skill

## Purpose
Production database access and schema design using Prisma and PostgreSQL.

## Schema principles
Use:
- primary keys
- foreign keys
- unique constraints
- NOT NULL constraints
- CHECK constraints where appropriate
- indexes based on real query patterns
- referential integrity

Avoid duplicate sources of truth.

## Prisma
Use Prisma for typed database access.

Prefer `select` to retrieve only required fields.

Avoid:
- unbounded findMany
- huge include trees
- unnecessary relation loading
- N+1 queries
- filtering huge datasets in Node

Push filtering, aggregation, sorting and pagination to PostgreSQL where appropriate.

## Numeric precision
Use PostgreSQL Numeric/Decimal for money and precision-sensitive KG/GSM/penalty values. Define precision/scale intentionally.

## Transactions
Use Prisma transactions when operations must succeed/fail atomically.

Critical examples:
- approvals
- inventory movements
- Kora ledger effects
- audit records
- corrections/reversals

Keep transactions short. Avoid slow external calls inside them.

## Concurrency
Consider duplicate approvals, simultaneous Kora consumption, concurrent inventory changes and retries.

Use:
- conditional updates
- unique constraints
- transactions
- appropriate isolation/locking
- optimistic concurrency where appropriate

Example:
UPDATE ... WHERE id = ? AND status = 'PENDING_APPROVAL'

Then verify the transition occurred.

## Query performance
Review filters, joins, sort fields, indexes, selected columns, pagination, cardinality and query count.

Use `EXPLAIN ANALYZE` during performance investigations.

## Migrations
All schema changes require Prisma migrations. Never use `prisma migrate reset` against production.

## Historical records
Do not hard-delete auditable production records. Use status/adjustment/reversal patterns defined by the domain.

## Testing
Important database behavior requires integration tests, especially constraints and transactional workflows.
