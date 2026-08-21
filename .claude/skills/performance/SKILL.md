# Performance Skill

## Purpose
Optimize backend performance without sacrificing correctness.

## Process
1. Correctness first.
2. Measure/identify bottleneck.
3. Optimize.
4. Verify improvement.

Do not optimize blindly.

## Time complexity
For every algorithm, not only non-trivial ones, state and prioritize:
`Time: O(...)`

Examples:
- Map/Set lookup: average O(1)
- array search: O(n)
- sorting: O(n log n)
- nested loops: commonly O(n²)

Avoid O(n²) when data can grow.

Example:
Repeated `.find()` across n colors and m records can be O(n*m).
Building a Map is O(n), then lookups are average O(1), for O(n+m).

## Space complexity
State:
`Space: O(...)`

Avoid:
- millions of rows in Node memory
- huge relation graphs
- duplicate arrays/objects
- unbounded queues

Prefer pagination, bounded batches, database aggregation and selective fields.

## Database performance
Review:
- expected row count
- filters
- joins
- indexes
- sorting
- pagination
- selected columns
- query count

Avoid:
- N+1
- unbounded findMany
- unnecessary includes
- unindexed filters
- filtering huge datasets in Node

Use PostgreSQL for filtering, aggregation and sorting where appropriate.

Use `EXPLAIN ANALYZE` for important investigations.

## Batch processing
Process large jobs in bounded batches.

Use safe bulk operations when business correctness permits.

## Caching
Do not add caching automatically.

Evaluate volatility, read/write ratio, consistency, invalidation and measured bottleneck.

Do not cache approval-sensitive or inventory-sensitive values without a clear consistency strategy.

Prefer database/index optimization before Redis.

## Complexity reporting
For every feature, not only non-trivial ones, report and prefer the most optimal correct approach:
- algorithmic time
- algorithmic space
- major queries
- indexes
- expected query count
- N+1 risk
