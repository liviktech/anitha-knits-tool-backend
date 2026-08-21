# Company Signup + Login (`/api/v1/auth/signup`, `/api/v1/auth/login`)

## Context

Business flow (per PRD / user instruction): a `Company` is created first, with admin credentials supplied at that time. The admin then logs in against the `User` table using mobile + password. Once logged in, the admin creates `MANAGER`/`SUPERVISOR`/`EMPLOYEE` users (a future API).

Prior work (`docs/jwt-implementation.md`) had already built the reusable JWT infrastructure — `signAccessToken`/`verifyAccessToken`, `requireAuth`/`optionalAuth`, `hashPassword`/`comparePassword`, `setAuthCookies` — but explicitly did not touch `schema.prisma` or build a login/signup controller. `schema.prisma` already had `Company`/`User` models (added separately, with a comment documenting the intended 3-step flow) but no migration had created the tables yet.

This pass built both endpoints in two turns: signup first, then login, reusing the JWT infrastructure as-is.

## Design decisions (confirmed with the user)

**Signup:**
- `companyCode` (e.g. `AK001`) is supplied by the client, not generated server-side — issued by a Super Admin elsewhere.
- Signup does **not** auto-login. It only creates the `Company` + `ADMIN` `User` rows; no tokens are issued. Login is a separate call.
- Admin `name` stays optional, matching the `User.name` column.

**Login:**
- `User.mobile` is unique only **per company** (`@@unique([companyId, mobile])`), not globally — the schema explicitly notes "the same mobile number can technically belong to another company." The user chose **mobile + password only** (no `companyCode` in the request) over requiring a company identifier.
- Consequence: a login request can match more than one `User` row (same mobile, different companies). The service checks the password against every same-mobile candidate and only succeeds if **exactly one** matches; if two or more match (e.g. two companies' admins happen to share both mobile and password), it fails closed with a distinct `AMBIGUOUS_LOGIN` (409) rather than guessing.
- Tokens are set as httpOnly cookies only (`setAuthCookies`, already built) — nothing token-shaped is returned in the JSON body, so there's nothing for XSS/log-scraping to steal from a response payload.

## New/changed files

**`src/validations/authValidation.ts`**
- `signupSchema` (`.strict()`): `companyName`, `companyAddress?`, `gst?`, `companyCode`, `adminMobile` (regex `^[0-9]{10,15}$`), `adminPassword` (`.min(8).max(128)`), `adminName?`. Never accepts `isActive`/`role`/ids — those are server-controlled.
- `loginSchema` (`.strict()`): `mobile` (same regex), `password` (`.min(1).max(128)` — no minimum-strength check on login, only bounded length; strength belongs at signup/password-change, not at the door).

**`src/services/authService.ts`**
- `signupCompany(input)` — hashes the password once (`hashPassword`), reused for both `Company.adminPasswordHash` and the new admin `User.passwordHash`; creates both rows in one `prisma.$transaction`. On a Postgres unique-constraint violation (`P2002`), `mapUniqueConstraintError` inspects which column fired and throws a specific `ConflictError`: `COMPANY_CODE_EXISTS`, `COMPANY_MOBILE_EXISTS`, or `COMPANY_GST_EXISTS` (falls back to `COMPANY_ALREADY_EXISTS`).
  - Non-obvious: with Prisma 7's `@prisma/adapter-pg` driver adapter, the violated column isn't at the classic `err.meta.target` — it's nested at `err.meta.driverAdapterError.cause.constraint.fields`. Found this by triggering a real duplicate-key error against the dev DB and inspecting the actual shape; `mapUniqueConstraintError` checks that path (falling back to `target` for forward/backward compatibility).
- `loginUser(input)`:
  1. `prisma.user.findMany({ where: { mobile } })` (with the parent `company` selected) — every same-mobile row across all companies.
  2. `comparePassword` against each candidate; collect the ones that match.
  3. Zero matches → `UnauthorizedError('INVALID_CREDENTIALS', 401)`. More than one match → `ConflictError('AMBIGUOUS_LOGIN', 409)`. Exactly one → continue.
  4. If the matched user or its company is inactive → `ForbiddenError('ACCOUNT_INACTIVE', 403)`.
  5. Updates `User.lastLoginAt`, signs an access+refresh token pair (`{ sub, role, companyId, mobile }`, matching `TokenPayload`), returns `{ tokens, user, company }` (no password hash).
  - Timing-attack mitigation: when zero rows match the mobile number, the function still runs one `comparePassword` against a dummy bcrypt hash (`dummyPasswordHash`, computed once at module load) before rejecting — otherwise "mobile not found" would return measurably faster than "mobile found, wrong password", letting an attacker enumerate registered mobile numbers by response time.

**`src/controllers/authController.ts`**
- `signup` — `parseOrThrow(signupSchema)` → `signupCompany` → `sendSuccess(..., 201)`.
- `login` — `parseOrThrow(loginSchema)` → `loginUser` → `setAuthCookies(res, tokens)` → `sendSuccess(res, { user, company })` (200; tokens never touch the JSON body).

**`src/routes/authRoutes.ts`** — `POST /signup`, `POST /login`, both public (no `requireAuth`), each with an `@openapi` JSDoc block (request/response schema refs, documented error codes per status).

**`src/routes/index.ts`** — `router.use('/auth', authRoutes)`, filling the existing `// Mount additional feature routers here` placeholder. Final paths: `POST /api/v1/auth/signup`, `POST /api/v1/auth/login`.

**`src/config/swagger.ts`** — `Auth` tag; `SignupRequest`/`CompanySummary`/`AdminUserSummary`/`SignupResponse` and `LoginRequest`/`UserSummary`/`LoginCompanySummary`/`LoginResponse` schema components, matching the existing per-feature pattern (e.g. `ExtruderCreateRequest`/`ExtruderResponse`).

## Pre-existing issues found and fixed along the way

These blocked the signup migration from running at all; none were introduced by this work, but fixing them was required to ship it.

1. **`schema.prisma` had invalid syntax for Prisma 7's parser.** Every model used a formatting style with each field's attributes (`@map(...)`, `@db.X`, `@default(...)`, even `@relation(...)`) on their own indented line below the field name — and two `@relation(...)` calls had their argument list itself split across multiple lines. Prisma 7's schema parser rejects both; `prisma validate` failed on essentially the whole file. Fixed by merging every continuation line back onto its field's declaration line (mechanical, whitespace-only — verified with `prisma validate` then canonically reformatted with `prisma format`). The single-`@` vs `@@`-prefixed distinction was used to avoid touching legitimate standalone block attributes (`@@index`, `@@unique`, `@@map`).
2. **Migration history didn't match the live Neon database.** The one existing migration (`20260819122413_init`) had never actually been applied via `prisma migrate dev`/`deploy` against this database — yet the tables it describes already existed live (created some other way), and two more tables (`inventory`, `load_sent`) existed live without ever being captured in any migration file at all. `prisma migrate dev` saw this as "drift" and offered `prisma migrate reset` (drops the whole `public` schema — refused, this is a shared dev database with real data). Resolved non-destructively:
   - `prisma migrate resolve --applied 20260819122413_init` — baselines the existing migration as applied without touching data.
   - Hand-wrote a matching `20260819130000_add_inventory_and_load_sent/migration.sql` (columns/indexes/FKs verified by introspecting the live table structure directly via `information_schema`) and baselined it the same way.
   - Only then did `prisma migrate dev --name add_company_and_user` run cleanly, generating and applying the real new migration for `companies`/`users`.
3. **`.env` was missing `JWT_SECRET`/`JWT_REFRESH_SECRET` entirely** (server couldn't boot). Generated local dev secrets (`openssl rand -hex 32`) and appended the full JWT/bcrypt block from `.env.example`.

## Explicitly out of scope

- No `POST /api/v1/auth/refresh` or `/logout` route yet — `rotateTokens`/`clearAuthCookies` already exist as ready-to-call utilities from the JWT work, just not wired to a route.
- No manager/supervisor/employee creation API — the next piece of the flow per the user's original description.
- No rate limiting on login (brute-force defense) — flagging as a gap, not implemented here.
- Server-side refresh-token revocation is still absent (see `jwt-implementation.md`'s stateless-refresh tradeoff) — unchanged by this work.

## Verification performed

1. `npm run typecheck` — clean after both signup and login.
2. `prisma migrate dev` applied cleanly; confirmed `companies`/`users` tables and `UserRole` enum exist via live introspection.
3. Manual end-to-end against the real dev database (dev server + curl), all cleaned up afterward:
   - Signup: success (201, no password hashes in response); duplicate `companyCode`/`adminMobile`/`gst` → 409 with the specific code each; missing required field → 400; extra fields (`isActive`, `role`) rejected by `.strict()` → 400.
   - Login: correct credentials → 200, httpOnly `access_token`/`refresh_token` cookies set (confirmed via response headers: `HttpOnly; SameSite=Strict`, correct `Max-Age` matching `JWT_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN`), no tokens in the JSON body; wrong password → 401 `INVALID_CREDENTIALS`; unknown mobile → 401 `INVALID_CREDENTIALS` (same code/message as wrong-password, deliberately — no user enumeration); missing field → 400.
   - Ambiguous login: seeded two users in different companies sharing one mobile + one password directly via Prisma (not reachable through the API yet, since `Company.adminMobile` is globally unique) → login → 409 `AMBIGUOUS_LOGIN`.
   - Inactive account: seeded an inactive user the same way → login → 403 `ACCOUNT_INACTIVE`.
4. `/api/docs.json` confirmed to include the `Auth` tag and both operations.
