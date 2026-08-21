# Backend Architecture Skill

## Purpose
Production architecture and engineering boundaries for the Anitha Knits Node/Express backend.

## Principles
Prioritize:
1. Correctness
2. Security
3. Data integrity
4. Maintainability
5. Testability
6. Observability
7. Performance
8. Developer experience

Prefer simple, explicit designs. Do not introduce abstractions without a concrete reason.

## Architecture

Request
→ Middleware
→ Authentication
→ Authorization
→ Validation
→ Controller
→ Service/Domain Logic
→ Repository/Data Access
→ Prisma
→ PostgreSQL
→ Response

Typical structure:

src/
  app.ts
  server.ts
  config/
  modules/
  middleware/
  lib/
  utils/
  types/

prisma/
  schema.prisma
  migrations/

tests/
  unit/
  integration/
  e2e/

## Responsibilities

Routes:
- define HTTP endpoints
- compose middleware

Controllers:
- receive validated input
- call services
- map results to HTTP
- remain thin

Services:
- business rules
- orchestration
- state transitions
- transactions
- domain calculations

Repositories:
- database access where the existing architecture justifies them

Schemas:
- validate external input

Mappers:
- transform database/domain data into API responses

Middleware:
- auth
- authorization
- validation
- request IDs
- rate limiting
- error handling

Never put complex business logic or database workflows in controllers.

## Existing-code-first

Before starting development on any task, not only before creating a brand-new helper, service, repository, middleware, error class, mapper or utility:
1. Search the existing codebase.
2. Reuse suitable functionality.
3. Extend rather than duplicate where appropriate.

Do not rewrite unrelated modules.

## Feature workflow

1. Identify affected modules.
2. Identify dependencies.
3. Preserve existing contracts.
4. Make the smallest correct change.
5. Add tests.
6. Run typecheck/lint/tests.

For every algorithm, not only non-trivial ones, state and prioritize the most optimal correct approach:
Time: O(...)
Space: O(...)

Also consider database round trips and N+1 behavior.

## Comments
Keep comments to a single crisp line explaining what a non-obvious block does. No multi-line or paragraph comment blocks.
