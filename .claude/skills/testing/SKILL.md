# Testing Skill

## Purpose
Production testing standards.

## Layers

### Unit
Test:
- calculations
- state transitions
- validation rules
- reconciliation
- recipe resolution
- permission logic

### Integration
Test:
- Prisma queries
- constraints
- transactions
- repositories
- approval workflows
- inventory/Kora effects

### API
Test:
- authentication
- authorization
- validation
- status codes
- response shapes
- error handling

### E2E
Use for valuable critical workflows.

## State transition tests

Valid:
DRAFT → SUBMITTED
SUBMITTED → PENDING_APPROVAL
PENDING_APPROVAL → APPROVED
PENDING_APPROVAL → REJECTED

Invalid:
DRAFT → APPROVED
REJECTED → APPROVED
APPROVED → DRAFT
APPROVED → REJECTED

Unless an explicit adjustment/reversal workflow permits it.

## Edge cases
Always consider:
- zero quantities
- negative quantities
- decimal precision
- duplicates
- concurrent approval
- missing master data
- inactive recipes
- insufficient Kora
- rejected production
- already approved production
- invalid status
- missing permissions
- invalid date ranges
- very large quantities
- empty results
- pagination boundaries
- inactive/deleted master records

## Approval tests
Verify successful approval atomically applies required effects.

Verify failures roll back required changes.

Verify duplicate approval cannot create duplicate inventory/Kora effects.

## Quality
Tests should verify behavior rather than unnecessary implementation details.

Keep tests deterministic.

Never disable tests to make a feature pass.

Run relevant tests, typecheck and lint after implementation.
