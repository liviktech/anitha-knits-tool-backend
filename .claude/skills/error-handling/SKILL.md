# Error Handling Skill

## Purpose
Predictable and secure backend error handling.

## Error types
Prefer:
- NotFoundError
- ValidationError
- UnauthorizedError
- ForbiddenError
- ConflictError
- BusinessRuleError

Use stable machine-readable error codes.

Examples:
- PRODUCTION_NOT_FOUND
- INVALID_STATUS_TRANSITION
- PRODUCTION_ALREADY_APPROVED
- INSUFFICIENT_KORA_BALANCE
- RECIPE_NOT_ACTIVE
- GSM_RULE_NOT_FOUND

## Centralized middleware
Controllers/services should use typed errors. Central error middleware maps them to HTTP responses.

Do not duplicate error response formatting across controllers.

## HTTP mapping
404 not found
400/422 invalid input
401 unauthenticated
403 forbidden
409 conflict/state/concurrency/business violation
500 unexpected failure

## Production security
Never return:
- stack traces
- SQL
- Prisma internals
- credentials
- filesystem paths
- raw exception objects

Log technical details server-side with request/correlation ID where useful.

## Transactions
If a transaction fails:
- rollback as required
- log useful context
- return a stable error
- never claim success

## Async
Never swallow rejected promises.

Do not catch and ignore errors.

Preserve useful error cause/context when rethrowing.

## External services
Distinguish timeout, unavailable, rejected request, duplicate request and permanent business errors.

Do not blindly retry non-idempotent operations.
