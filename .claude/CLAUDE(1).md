# CLAUDE.md — Anitha Knits Production Backend

## 1. Project Purpose

This repository contains the production-grade backend for the **Anitha Knits internal Production Tool**.

The backend implements the factory production workflow defined by the Anitha Knits Production Module PRD:

Raw Material / Chemical / Colour
→ Extruder
→ Yarn
→ Kora Balance
→ Looms
→ Fabric
→ Fabric Checking
→ First Grade / Second Grade / FW / BW
→ Load Sent

The **Production Module PRD is the authoritative source for business requirements**.

Do not invent, simplify, reinterpret, or silently change business rules that are explicitly defined by the PRD.

If a technical recommendation conflicts with an explicit PRD business rule:
1. Preserve the PRD requirement.
2. Identify the technical conflict.
3. Propose a safe implementation.
4. Do not silently change the business behavior.

If the PRD does not define a business rule, do not silently invent one.

---

## 2. Technology Stack

The backend stack is:

- Node.js
- TypeScript
- Express.js
- PostgreSQL
- Neon PostgreSQL
- Prisma ORM
- REST APIs
- Zod or the project's established validation library
- ESLint
- Prettier
- Jest/Vitest or the project's established testing framework

Use the existing repository's conventions when they are already established.

Do not introduce a new framework, ORM, dependency, architectural pattern, or infrastructure component without a concrete technical reason.

---

## 3. Claude Skills

Detailed engineering rules are stored in:

`.claude/skills/`

Current skills:

- `backend-architecture`
- `node-express`
- `typescript`
- `prisma-postgresql`
- `neon-database`
- `api-design`
- `validation-security`
- `testing`
- `error-handling`
- `performance`
- `code-review`
- `migrations`
- `anitha-knits-production`

Use only the skills relevant to the current task.

Examples:

### API feature

Use:
- backend-architecture
- node-express
- typescript
- api-design
- validation-security
- prisma-postgresql
- anitha-knits-production

### Database/schema work

Use:
- prisma-postgresql
- neon-database
- migrations
- anitha-knits-production

### Performance investigation

Use:
- performance
- prisma-postgresql
- neon-database
- backend-architecture

### Testing

Use:
- testing
- typescript
- relevant domain skill

### Code review

Use:
- code-review
- validation-security
- performance
- testing
- relevant implementation/domain skills

Do not duplicate detailed skill content inside this file.

---

## 4. Development Workflow

Before modifying code:

1. Understand the requested feature.
2. Read the relevant PRD requirement.
3. Identify which skills apply.
4. Inspect the existing repository structure.
5. Inspect existing implementation and coding conventions.
6. Inspect the Prisma schema for database-related work.
7. Inspect existing authentication and authorization.
8. Search for existing utilities, middleware, services, repositories, validation helpers and error classes before creating new ones.
9. Identify affected modules and dependencies.
10. Identify business rules and state transitions.
11. Identify data-integrity and transaction requirements.
12. Identify required API changes.
13. Identify required tests.
14. Implement the smallest correct change.

Do not begin by rewriting or restructuring the entire project.

---

## 5. Existing-Code-First Rule

Before creating a new:

- utility
- helper
- middleware
- service
- repository
- validation schema
- error class
- database helper
- API response helper

search the existing codebase first.

If suitable functionality already exists:
- reuse it
- extend it carefully if necessary
- avoid creating duplicate implementations

Consistency with the existing codebase is preferred over introducing a theoretically cleaner but unrelated pattern.

---

## 6. Architecture

Prefer a modular, feature-oriented backend.

Conceptual request flow:

Request
→ Middleware
→ Authentication
→ Authorization
→ Validation
→ Controller
→ Service/Domain Logic
→ Repository/Prisma
→ Database
→ Response

Responsibilities:

### Routes
Define HTTP endpoints and middleware composition.

### Middleware
Handle cross-cutting concerns such as:
- authentication
- authorization
- validation
- request IDs
- rate limiting
- error handling

### Controllers
Translate HTTP requests into service calls and service results into HTTP responses.

Controllers must remain thin.

### Services
Contain business rules, orchestration, state transitions and transactional workflows.

### Repositories/Data Access
Encapsulate database access when the existing architecture uses a repository layer.

### Validation
Validate all external input before business logic executes.

Do not put complex business logic or database workflows directly in route handlers/controllers.

Do not create additional architectural layers unless they provide a real benefit.

---

## 7. TypeScript

Use strict TypeScript.

Prefer:
- explicit types
- discriminated unions
- narrow types
- `unknown` over `any`
- reusable domain types
- safe type narrowing

Avoid:
- `any`
- unsafe type assertions
- disabling strict TypeScript settings
- duplicated types
- unnecessary abstractions

Production status must be represented explicitly:

`DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED / REJECTED`

Do not allow arbitrary status strings or direct client-controlled status changes.

---

## 8. API Standards

Use versioned REST endpoints:

`/api/v1/...`

Follow the PRD endpoint definitions.

Use appropriate HTTP status codes:

- `200` successful retrieval/update/action
- `201` resource created
- `204` successful operation with no response body
- `400` malformed/invalid request
- `401` unauthenticated
- `403` authenticated but forbidden
- `404` resource not found
- `409` state/concurrency/business conflict
- `422` semantic validation failure where appropriate
- `429` rate limited
- `500` unexpected server error

Use consistent success and error response structures.

Never expose:
- stack traces
- SQL
- Prisma internals
- filesystem paths
- secrets
- internal exception details

Do not change an existing endpoint's request/response contract unless:
- explicitly requested
- required by the PRD
- or necessary for a clearly identified compatibility fix

If a breaking API change is necessary, identify it before implementing it.

---

## 9. Validation and Security

Validate all external input server-side:

- request body
- route parameters
- query parameters
- relevant headers
- uploaded data where applicable

Frontend validation is not a security boundary.

Authentication determines who the user is.

Authorization determines what the user is allowed to do.

Never trust client-provided:
- roles
- permissions
- user identity
- approval information
- organization/company IDs

Prevent mass assignment.

Never blindly pass:

`req.body`

to Prisma.

Explicitly map allowed fields.

Protected fields such as:
- status
- approval metadata
- inventory effects
- Kora effects
- audit metadata
- createdBy
- approvedBy
- approvedAt

must be controlled by backend logic.

Protect against common application security risks including:
- SQL injection
- broken access control
- insecure direct object references
- mass assignment
- sensitive data exposure
- denial of service
- unsafe file uploads
- authentication flaws

Never log passwords, tokens, API keys, database credentials or unnecessary sensitive data.

---

## 10. Database

PostgreSQL is the persistent data store.

Use Prisma for database access.

Prioritize:

- primary keys
- foreign keys
- unique constraints
- NOT NULL constraints
- CHECK constraints where useful
- appropriate indexes
- referential integrity
- correct numeric precision

Use Prisma migrations for schema changes.

Never manually alter the production schema outside the controlled migration process.

Never use destructive database commands such as:

`prisma migrate reset`

against a production database.

Never delete/recreate production data to solve a development problem.

Use `select` to retrieve only the fields required by the operation.

Avoid:
- N+1 queries
- unbounded queries
- unnecessary relation loading
- loading entire tables into Node memory
- duplicate sources of truth

Use PostgreSQL numeric/decimal types for monetary and precision-sensitive quantities.

Do not use JavaScript floating-point arithmetic for money.

---

## 11. Transactions and Data Integrity

Use transactions when multiple database operations form one atomic business operation.

Especially for:

- production approval
- inventory effects
- Kora ledger effects
- wastage approval
- correction/reversal workflows
- other approval workflows

Example approval workflow:

1. Verify current state.
2. Verify authorization.
3. Validate business rules.
4. Update production status.
5. Create required inventory movements.
6. Create required Kora ledger effects.
7. Create audit records.

These operations must have appropriate transactional guarantees.

Do not update production, inventory and Kora independently when the business operation requires atomicity.

Keep transactions short.

Avoid slow external HTTP calls inside database transactions whenever possible.

---

## 12. Concurrency and Idempotency

Always consider concurrent requests.

Important cases include:

- two users approving the same production record
- simultaneous Looms consumption of Kora
- duplicate approval requests
- retried API requests
- duplicate external integration events

Use appropriate:
- transactions
- conditional updates
- unique constraints
- optimistic concurrency
- database isolation/locking where required

Approval operations must safely handle retries.

A retry must not create duplicate inventory movements or Kora ledger effects.

---

## 13. Anitha Knits Critical Business Rules

These rules are non-negotiable unless the PRD is changed.

1. Inventory is never updated directly from the UI/controller.
2. Inventory-affecting production remains pending until Manager approval.
3. Approved production finalizes inventory/Kora effects.
4. Rejected transactions do not update inventory.
5. Approved transactions cannot be silently edited.
6. Corrections use adjustment/reversal workflows.
7. Approved production records are not hard-deleted.
8. Kora Balance is ledger-derived, not an arbitrary editable value.
9. Approved Extruder output increases Kora.
10. Approved Looms yarn consumption decreases Kora.
11. KG is the canonical production/inventory quantity unit.
12. GSM is a separate quality measurement.
13. Recipes must not be hard-coded.
14. Wastage limits must not be hard-coded.
15. GSM limits must not be hard-coded.
16. Critical production, wastage, GSM and approval actions must be auditable.

Preserve client terminology exactly:

- Extruder
- Looms
- Kora Balance
- Yarn Waste
- LUMS / LUMPS
- Looms Waste
- FW
- BW
- B White
- B Blue
- Fabric Checking
- First Grade
- Second Grade
- GSM
- GSM Penalty
- Load Sent

### Kora Balance

Conceptually:

`Kora Balance = Approved Extruder/Yarn Output - Approved Looms Yarn Input`

Never create an arbitrary balance overwrite operation.

### Recipes

Production-level recipe overrides must preserve:
- original recipe/version
- overridden/effective values
- user
- timestamp
- reason where required

### Fabric Checking

Track separately:
- First Grade
- Second Grade
- FW
- BW

Bit wastage supports colour-level tracking.

### GSM

Store:
- Actual GSM
- Allowed GSM
- GSM Variance
- GSM Penalty Amount

Do not invent the final GSM penalty formula if it has not been confirmed.

---

## 14. State Transitions

Treat production statuses as explicit state-machine transitions.

Valid flow:

`DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED`

or:

`PENDING_APPROVAL → REJECTED`

Do not allow direct client status mutation such as:

`PATCH /production/:id`
`{ "status": "APPROVED" }`

Use dedicated operations such as:
- submit
- approve
- reject

Reject invalid state transitions.

---

## 15. Auditability

Critical actions should be auditable:

- creation
- editing
- submission
- approval
- rejection
- recipe overrides
- wastage actions
- GSM checks
- GSM penalties
- Load Sent changes
- adjustments
- reversals
- master-data changes

Where appropriate capture:
- actor
- action
- entity type
- entity ID
- timestamp
- before/after information
- reason
- request/correlation ID

Audit records should not be casually editable by normal users.

---

## 16. Performance

Use the dedicated `performance` skill for detailed performance guidance.

For non-trivial algorithms, consider:

`Time: O(...)`

`Space: O(...)`

Avoid:
- unnecessary O(n²) processing
- repeated array searches inside loops
- unbounded in-memory processing
- N+1 queries
- unbounded database results

Prefer:
- Map/Set for repeated lookups
- database-side filtering
- database-side aggregation
- indexed queries
- pagination
- bounded batches
- selective fields

For important database performance investigations, use PostgreSQL `EXPLAIN ANALYZE`.

Do not claim exact database Big-O complexity without considering indexes, query planner behavior and data cardinality.

---

## 17. Pagination and Filtering

Production list APIs must be bounded.

Where applicable support the PRD filters:

- `date_from`
- `date_to`
- `stage`
- `color_id`
- `size`
- `status`
- `wastage_type`

Validate pagination parameters.

Use a sensible maximum page size.

Whitelist sortable fields.

Never allow arbitrary SQL expressions from clients.

---

## 18. Error Handling

Use centralized error handling.

Prefer typed/domain errors such as:

- NotFoundError
- ValidationError
- ForbiddenError
- ConflictError
- BusinessRuleError

Use stable machine-readable error codes.

Examples:

- `PRODUCTION_NOT_FOUND`
- `INVALID_STATUS_TRANSITION`
- `PRODUCTION_ALREADY_APPROVED`
- `INSUFFICIENT_KORA_BALANCE`
- `RECIPE_NOT_ACTIVE`
- `GSM_RULE_NOT_FOUND`

Do not expose internal exception details in production responses.

Use the dedicated `error-handling` skill for detailed implementation rules.

---

## 19. Testing

Production code must be testable.

Use the repository's established testing framework.

Important test areas:

### Unit
- business calculations
- state transitions
- validation
- authorization logic
- reconciliation
- recipe resolution

### Integration
- Prisma queries
- database constraints
- transactions
- approval workflows
- inventory/Kora effects

### API
- authentication
- authorization
- validation
- HTTP status codes
- response structure
- error cases

Critical approval, inventory and Kora workflows require tests.

Always test both valid and invalid state transitions.

Use the dedicated `testing` skill for detailed testing practices.

---

## 20. Migrations

Use Prisma migrations for schema changes.

Before a migration:

1. Inspect the current schema.
2. Consider existing data.
3. Identify required backfills.
4. Review indexes and constraints.
5. Consider migration duration/locking.
6. Test the migration before production.

Never casually reset a production database.

Use the dedicated `migrations` skill for detailed migration practices.

---

## 21. Screen-by-Screen Development

This project will be developed screen-by-screen.

For each screen/feature:

1. Understand the workflow.
2. Identify required master data.
3. Identify entities.
4. Identify APIs.
5. Identify validation.
6. Identify permissions.
7. Identify state transitions.
8. Identify transaction requirements.
9. Implement backend changes.
10. Add tests.
11. Verify existing functionality.

Modify only the files/modules required for the requested feature unless a dependency genuinely requires a broader change.

Do not refactor unrelated modules during feature implementation.

Do not implement frontend assumptions as backend business rules.

The backend should expose a clear, stable contract for the frontend.

---

## 22. Code Generation Rules

When asked to implement a feature:

1. Briefly state the implementation approach.
2. Identify files to create/change.
3. Inspect existing code before modifying it.
4. Identify relevant skills.
5. Implement complete production-quality functionality.
6. Do not leave core functionality as TODOs or pseudo-code.
7. Include validation.
8. Include authorization where required.
9. Include appropriate error handling.
10. Include tests for important business logic.
11. Include migrations when schema changes.
12. State important assumptions.
13. Mention time/space complexity for non-trivial logic.
14. Provide verification commands.

Do not rewrite unrelated code.

Do not change existing public API contracts without an explicit requirement.

---

## 23. Final Verification

Before considering a feature complete, verify where applicable:

- TypeScript compiles
- lint passes
- formatting passes
- relevant tests pass
- Prisma schema/migrations are valid
- validation exists
- authorization exists
- error handling exists
- transaction boundaries are correct
- queries are reviewed
- indexes are considered
- concurrency is considered
- idempotency is considered
- audit requirements are satisfied
- no secrets are exposed
- no unrelated files were unnecessarily changed

---

## 24. Final Principle

Build this backend as a long-lived production system.

Every implementation should preserve:

- correctness
- security
- data integrity
- auditability
- testability
- observability
- performance
- maintainability
- Anitha Knits terminology
- Anitha Knits production workflow

The PRD defines the business behavior.

The skills define detailed engineering practices.

The existing codebase defines established implementation conventions.

Use all three together, and when they conflict, identify the conflict rather than silently making a destructive assumption.
