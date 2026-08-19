# TypeScript Skill

## Purpose
Strict, maintainable TypeScript for the Anitha Knits backend.

## Compiler
Use strict TypeScript. Prefer:
- strict: true
- noImplicitAny
- strictNullChecks
- noUnusedLocals
- noUnusedParameters
- noUncheckedIndexedAccess where practical

Never disable strictness to make code compile.

## Types
Prefer:
- explicit domain types
- discriminated unions
- narrow types
- `unknown` for untrusted values
- safe type narrowing

Avoid:
- `any`
- unsafe assertions
- duplicated types
- unnecessary abstractions

## Domain and transport types
Request DTOs, domain types and response DTOs may differ. Do not force one type across all layers when it reduces safety.

Never pass raw request bodies into domain/database operations.

## State machines
Represent constrained states explicitly.

Example:

type ProductionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED";

Use exhaustive handling for state transitions.

## Nullability
Handle null/undefined explicitly. Avoid non-null assertions as shortcuts.

## Numeric precision
Use Prisma Decimal/PostgreSQL Numeric for monetary and precision-sensitive quantities. Never use JavaScript floating-point arithmetic for money.

Centralize rounding and precision-sensitive calculations.

## Complexity
For non-trivial functions state:
Time: O(...)
Space: O(...)
