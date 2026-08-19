# Code Review Skill

## Purpose
Production review checklist.

## Correctness
- Satisfies PRD?
- Business rules enforced server-side?
- State transitions correct?
- Edge cases handled?
- Calculations deterministic?

## Architecture
- Logic in correct layer?
- Controllers thin?
- Existing functionality reused?
- New abstractions justified?
- Unrelated code untouched?

## Security
- Authentication?
- Authorization?
- Input validation?
- Mass assignment protection?
- Secrets protected?
- Safe error responses?

## Database
- Constraints correct?
- Required indexes?
- Efficient queries?
- N+1?
- Appropriate select/include?
- Transaction required?
- Concurrency risk?

## Reliability
- Retry safety?
- Idempotency?
- Duplicate events?
- External failure handling?
- Rollback?

## Performance
- Time complexity?
- Space complexity?
- Bounded query?
- Pagination?
- Database round trips?
- Query plan/index considerations?

## Testing
- Happy path?
- Validation failures?
- Authorization failures?
- State transition failures?
- Concurrency/idempotency?
- Transaction behavior?

## Maintainability
- Clear naming?
- Focused functions?
- No unnecessary abstraction?
- No duplicated business rules?
- Documentation updated?

## Review severity
Identify in order:
1. critical correctness/security issues
2. data-integrity issues
3. performance issues
4. maintainability issues
5. test gaps
6. optional improvements

Do not label cosmetic refactors as critical.
