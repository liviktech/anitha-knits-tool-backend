# Anitha Knits Production Domain Skill

## Purpose
Business/domain rules for the Anitha Knits Production Module.

The PRD is authoritative. If the PRD changes, this skill must be updated.

Never invent rules that are pending client confirmation.

## Terminology
Preserve exactly:
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

## Production flow

Raw Material / Chemical / Colour
→ Extruder
→ Yarn
→ Kora Balance
→ Looms
→ Fabric
→ Fabric Checking
→ First Grade / Second Grade / FW / BW
→ Load Sent

## Critical business rules

1. Inventory is never updated directly by the UI.
2. Inventory-affecting production remains pending until Manager approval.
3. Approved production finalizes inventory/Kora ledger effects.
4. Rejected transactions do not update inventory.
5. Approved transactions cannot be silently edited.
6. Corrections require adjustment/reversal.
7. Kora Balance is ledger-derived.
8. Approved Extruder output increases Kora.
9. Approved Looms yarn consumption decreases Kora.
10. KG is the canonical production/inventory quantity unit.
11. GSM is a separate quality measurement.
12. Recipes must not be hard-coded.
13. Wastage limits must not be hard-coded.
14. GSM limits must not be hard-coded.
15. Critical actions must be auditable.

## Production state machine

Valid:
DRAFT
→ SUBMITTED
→ PENDING_APPROVAL
→ APPROVED

or:
PENDING_APPROVAL
→ REJECTED

Do not allow arbitrary status mutation.

Invalid examples:
- DRAFT → APPROVED
- REJECTED → APPROVED
- APPROVED → DRAFT
- APPROVED → REJECTED

unless an explicit adjustment/reversal workflow permits it.

## Approval workflow

For approval:
1. Verify record exists.
2. Verify current state is PENDING_APPROVAL.
3. Verify Manager/appropriate permission.
4. Validate business rules.
5. Apply status transition.
6. Create inventory movements.
7. Create Kora ledger effects.
8. Create audit/approval record.
9. Commit atomically.

Repeated approval must not duplicate effects.

## Kora Balance

Kora is ledger-driven.

Never expose arbitrary balance overwrite.

Conceptually:

Kora Balance =
Approved Extruder/Yarn Output
− Approved Looms Yarn Input

Approved Extruder output:
- positive Kora ledger effect

Approved Looms yarn consumption:
- negative Kora ledger effect

Any unreconciled variance must remain visible for management review.

## Inventory

Prefer immutable inventory movements containing:
- material/item
- quantity
- direction/type
- source
- sourceRecordId
- actor
- timestamp

Production approval creates required inventory movements inside the appropriate transaction.

Do not mutate balances directly from controllers.

## Recipes

Recipes are configurable.

Production records must preserve enough information to reproduce what happened at the time.

For overrides preserve:
- original recipe/version
- effective values
- overridden values
- user
- timestamp
- reason where required

Use versioning instead of mutating historical recipe definitions.

## Wastage

Preserve configured wastage types and client terminology.

Do not hard-code thresholds.

If thresholds are pending confirmation, keep them configurable/TBD.

## Fabric Checking

Track separately:
- First Grade
- Second Grade
- FW
- BW

Bit wastage supports colour-level tracking.

Make unexplained reconciliation differences visible. Do not silently force totals to match.

## GSM

Store where required:
- Actual GSM
- Allowed GSM
- GSM Variance
- GSM Penalty Amount

GSM Variance:

Actual GSM - Allowed GSM

Do not invent the final GSM penalty calculation if pending confirmation.

Keep calculations deterministic, centralized and testable.

## Load Sent

Treat Load Sent as the outward-load operation defined by the PRD.

Do not invent a separate Dispatch workflow.

Whether Load Sent requires approval in every case is pending client confirmation; do not hard-code an unconfirmed rule.

## Auditability

Audit:
- creation
- edit
- submission
- approval
- rejection
- recipe override
- wastage changes
- GSM record/penalty
- Load Sent changes
- adjustments/reversals
- master-data changes

Where appropriate record:
- actor
- action
- entity type
- entity ID
- timestamp
- before/after
- reason
- request/correlation ID

Audit history should be append-oriented and protected from ordinary modification.

## Reconciliation

Kora:
Approved Extruder Output
− Approved Looms Yarn Input
= Kora Balance

Fabric:
Fabric received
vs
First Grade + Second Grade + FW + BW

Do not silently force reconciliation. Preserve adjustments and audit trails.

## Pending client confirmation

Do not hard-code these until confirmed:
- exact production duration/capacity
- multiple production records per shift
- First Grade vs Second Grade classification
- final wastage thresholds
- whether wastage thresholds vary by product/colour/size
- exact GSM allowed limits
- whether GSM limits vary by product/size/colour
- exact GSM penalty calculation
- whether Load Sent always requires approval

## Domain calculations

Calculations must be:
- deterministic
- centralized
- unit-tested
- precision-aware

For non-trivial calculations:
Time: O(...)
Space: O(...)

Do not scatter rounding or business formulas across controllers.
