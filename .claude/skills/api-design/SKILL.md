# API Design Skill

## Purpose
Consistent, secure REST API design.

## Versioning
Use:
`/api/v1/...`

Do not make breaking changes without explicit approval.

## Resource design
Use nouns for resources and dedicated operations for state transitions.

Example:

POST /api/v1/production
GET /api/v1/production
GET /api/v1/production/:id
PATCH /api/v1/production/:id

State operations:

POST /api/v1/production/:id/submit
POST /api/v1/production/:id/approve
POST /api/v1/production/:id/reject

Do not expose arbitrary status mutation through generic PATCH.

## Status codes
200 success
201 created
204 no body
400 malformed/invalid request
401 unauthenticated
403 forbidden
404 not found
409 conflict/state/concurrency
422 semantic validation failure where appropriate
429 rate limit
500 unexpected error

## Response format
Use a stable structure such as:

{
  "success": true,
  "data": {},
  "meta": {}
}

Errors:

{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "...",
    "details": {}
  }
}

Never expose internal exception messages.

## Pagination
All production lists must be bounded.

Use cursor pagination for large/changing datasets where appropriate. Offset pagination is acceptable for moderate administrative lists.

Validate page/limit or cursor, sorting and filters.

Set a maximum page size.

## Filters
Support PRD filters where relevant:
- date_from
- date_to
- stage
- color_id
- size
- status
- wastage_type

Whitelist sortable fields. Never accept arbitrary SQL/order expressions.

## Idempotency
Retryable operations must be safely repeatable where appropriate, especially approvals, inventory movements and integration callbacks.

Use idempotency keys, unique constraints, source event IDs or conditional state transitions.

## Documentation
Document important endpoints with:
- purpose
- auth
- permissions
- request schema
- response schema
- validation
- status codes
- business rules
- examples

Keep OpenAPI/Swagger synchronized if used.
