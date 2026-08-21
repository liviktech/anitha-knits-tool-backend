# JWT Auth Middleware (requireAuth / optionalAuth)
 
## Context
 
`anitha-knits-tool-backend` currently has **no authentication or authorization at all**. `src/utils/actor.ts` (`getActor`) explicitly reads identity from an untrusted `x-user-email` header as a stand-in, with a comment saying to replace it once real auth exists. `src/prisma/schema.prisma` (the live schema) has no `User`/`Company` models yet — those only exist in `docs/updated-multi-tenant-schema.prisma`, which the user is still iterating on and will swap in later.
 
Goal of this task: build the **reusable JWT auth infrastructure** — `requireAuth`, `optionalAuth`, JWT sign/verify, bcrypt hashing, and an httpOnly-cookie token — so that whenever the login endpoint and the real Prisma schema land, protecting a route is a one-line `requireAuth('ADMIN')` / `optionalAuth` addition. Per explicit instruction, this task does **not** touch `schema.prisma`, run a migration, build a login controller/route, or attach these middlewares to any existing route — that's future work once the schema is finalized.
 
Confirmed with the user:
- Role set: `ADMIN | MANAGER | SUPERVISOR | EMPLOYEE` (matches `docs/updated-multi-tenant-schema.prisma`'s `UserRole`, even though the task text only named 3 of the 4).
- JWT payload shape is contract-only (not Prisma-typed): `sub` (userId), `role`, `companyId`, `mobile` — mirrors `User.id/role/companyId/mobile` in the docs schema.
- No schema/migration changes, no login route — utils/middleware only.
- Includes refresh-token logic (added per follow-up): short-lived access token + longer-lived refresh token, both httpOnly cookies, with a reusable rotate function a future `/auth/refresh` route calls in one line.
 
**Stateless-refresh tradeoff (flagging, not blocking):** since no schema/DB changes are in scope, the refresh token cannot be revoked server-side (no session/token table to blacklist against) — logout only clears cookies; a stolen refresh token stays valid until it naturally expires. Proper revocation (e.g. a `RefreshToken`/session table, rotation-with-reuse-detection) is a natural follow-up once the schema lands, not part of this pass.
 
## New/changed files
 
**`src/types/auth.ts`** (new)
- `export type Role = 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'EMPLOYEE';`
- `export interface TokenPayload { sub: string; role: Role; companyId: string; mobile: string; }` — the shared claim set.
- `export interface AccessTokenPayload extends TokenPayload { type: 'access'; }`
- `export interface RefreshTokenPayload extends TokenPayload { type: 'refresh'; }` — the `type` discriminant stops a refresh token from being replayed as an access token (or vice versa) even though both are valid, correctly-signed JWTs.
- `declare global { namespace Express { interface Request { user?: AccessTokenPayload } } }` so `req.user` is typed everywhere without casts.
 
**`src/config/env.ts`** (edit)
- Extend the existing zod `envSchema` with:
  - `JWT_SECRET` (required, `.min(32)`) — signs access tokens.
  - `JWT_EXPIRES_IN` (default `'15m'`)
  - `JWT_COOKIE_NAME` (default `'access_token'`)
  - `JWT_REFRESH_SECRET` (required, `.min(32)`) — separate secret from access tokens, so a leaked access-token secret alone can't forge refresh tokens.
  - `JWT_REFRESH_EXPIRES_IN` (default `'7d'`)
  - `JWT_REFRESH_COOKIE_NAME` (default `'refresh_token'`)
  - `BCRYPT_SALT_ROUNDS` (`z.coerce.number().int().positive().default(10)`)
- Same fail-fast pattern already used (`safeParse` → `process.exit(1)` on failure).
 
**`.env.example`** (edit) — add the 7 new vars with placeholder values, same style as existing entries.
 
**`package.json`** (edit) — add deps `jsonwebtoken`, `bcryptjs`, `cookie-parser`; devDeps `@types/jsonwebtoken`, `@types/bcryptjs`, `@types/cookie-parser`.
- `bcryptjs` over native `bcrypt`: pure JS, no node-gyp/native build step (avoids Windows dev-machine build pain), matches this repo's otherwise dependency-light style; hashing frequency here (login/password-change) doesn't need bcrypt's native speed edge.
 
**`src/utils/errors.ts`** (edit) — add two classes following the exact existing `NotFoundError`/`ValidationError`/`ConflictError` pattern (single-line JSDoc, `ApiError` subclass):
- `UnauthorizedError` → 401 (default code `AUTH_REQUIRED`)
- `ForbiddenError` → 403 (default code `INSUFFICIENT_ROLE`)
 
No changes needed to `src/middlewares/errorHandler.ts` — it's already fully generic over `ApiError` subclasses.
 
**`src/utils/password.ts`** (new) — reusable bcrypt block (Rule 2: build once, reuse everywhere a password is hashed/compared, e.g. future login/register/change-password):
- `hashPassword(plain: string): Promise<string>` — `bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS)`
- `comparePassword(plain: string, hash: string): Promise<boolean>` — `bcrypt.compare(plain, hash)`
- Complexity note in comment: cost is `O(2^saltRounds)` per call by design (that's bcrypt's point), independent of input length; O(1) space.
 
**`src/utils/jwt.ts`** (new)
- `signAccessToken(payload: TokenPayload): string` — `jwt.sign({ ...payload, type: 'access' }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })`
- `signRefreshToken(payload: TokenPayload): string` — `jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN })`
- `verifyAccessToken(token: string): AccessTokenPayload` — `jwt.verify` with `JWT_SECRET`; catch `TokenExpiredError` → `UnauthorizedError('Token expired', 'AUTH_TOKEN_EXPIRED')`, any other failure (bad signature, malformed, or `type !== 'access'`) → `UnauthorizedError('Invalid token', 'AUTH_TOKEN_INVALID')`.
- `verifyRefreshToken(token: string): RefreshTokenPayload` — same shape, verifies with `JWT_REFRESH_SECRET`, rejects unless `type === 'refresh'`.
- `rotateTokens(refreshToken: string): { accessToken: string; refreshToken: string }` — `verifyRefreshToken`, strip `type`/`iat`/`exp`, then `signAccessToken` + `signRefreshToken` off the same claims (rotates the refresh token too, so a reused old refresh cookie silently diverges from the client's latest one — the closest thing to reuse detection this stateless design supports). This is the single reusable block a future `POST /auth/refresh` controller calls.
- All four are O(1) time/space — fixed-size HMAC sign/verify, no I/O.
 
**`src/utils/authCookie.ts`** (new) — single source of truth for cookie options (Rule 2 reuse target for the future login/logout/refresh controllers):
- `setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }): void` — sets both: access cookie (`env.JWT_COOKIE_NAME`) and refresh cookie (`env.JWT_REFRESH_COOKIE_NAME`), each `{ httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/', maxAge: <ms derived from the matching *_EXPIRES_IN> }`.
- `clearAuthCookies(res: Response): void` — `res.clearCookie` for both names, same `path`.
- `httpOnly` blocks JS/XSS access to either token; `sameSite: 'strict'` is the actual CSRF defense (cookies aren't sent on cross-site requests) — this is what the task's "prevent CSRF" requirement maps to.
- Note in-file: once a real `/api/v1/auth/refresh` route exists, consider scoping the refresh cookie's `path` to just that route so it isn't sent on every request — left at `/` for now since the route doesn't exist yet.
 
**`src/middlewares/auth.ts`** (new) — the core deliverable:
- Local helper `extractAccessToken(req): string | undefined` — reads `req.cookies[env.JWT_COOKIE_NAME]` first, falls back to `Authorization: Bearer <token>` header (useful for Swagger/API testing). Shared by both middlewares below (Rule 2: one extraction path, not duplicated). Refresh tokens are never read off arbitrary requests — only a future `/auth/refresh` handler reads `req.cookies[env.JWT_REFRESH_COOKIE_NAME]` directly.
- `requireAuth(...allowedRoles: Role[]): RequestHandler` — factory function.
  - No token → `next(new UnauthorizedError('Authentication required', 'AUTH_REQUIRED'))`.
  - Verify via `verifyAccessToken` (already throws typed `UnauthorizedError` on bad/expired/wrong-type token) → `next(err)` on failure.
  - If `allowedRoles.length > 0` and `payload.role` not in the set → `next(new ForbiddenError(...))`.
  - Else `req.user = payload; next();`.
  - Usage examples in the file's JSDoc: `requireAuth()` (any authenticated role), `requireAuth('ADMIN', 'MANAGER')` (role-restricted).
- `optionalAuth: RequestHandler` — no token → `next()` immediately, `req.user` stays `undefined`. Token present but invalid/expired → swallow the error and `next()` anyway (never blocks), matching "forwards to all those have access" — an invalid/optional token degrades to anonymous rather than a hard failure. Token present and valid → attach `req.user`, `next()`.
- Both are synchronous (no DB round-trip — stateless JWT verification only), so no `asyncHandler` wrapping needed. Time: O(1), Space: O(1) per request.
 
**`src/app.ts`** (edit) — add `import cookieParser from 'cookie-parser';` and `app.use(cookieParser());` right after `express.urlencoded(...)`, so `req.cookies` is populated for `extractAccessToken`. One-line wiring, not business logic.
 
## Explicitly out of scope (per user instruction)
 
- No changes to `src/prisma/schema.prisma`, no migration.
- No login/register/refresh controller, service, or route — `rotateTokens` exists as a ready-to-call utility, but nothing invokes it yet since that needs the real `User` model first.
- No server-side refresh-token revocation/session table (see stateless-refresh tradeoff above).
- No wiring of `requireAuth`/`optionalAuth` onto existing routes (extruder/looms/etc.) — that changes existing route behavior, which is explicitly out of scope today.
- `src/app.ts`'s CORS `origin: true` (marked `TEMPORARY` in an existing comment) is a latent risk once cookie auth + `credentials: true` are both live — flagging it, not touching it now since it's unrelated existing logic.
 
## Skill/CLAUDE.md updates (3 requested rules)
 
Small, targeted wording edits — no new files, no duplicated content across skills:
 
1. **Comments crisp & single-line**: add one line to `.claude/skills/typescript/SKILL.md` and `.claude/CLAUDE(1).md` (near existing style guidance) — "Comments must be a single crisp line explaining *what*, not multi-line/paragraph blocks." Matches what the codebase already does (`asyncHandler.ts`, `errors.ts`).
2. **Reuse-first**: strengthen existing wording in `.claude/CLAUDE(1).md` §5 ("Existing-Code-First Rule") and `.claude/skills/backend-architecture/SKILL.md` ("Existing-code-first") from "before creating a new utility..." to "before starting any development, search for and reuse an existing block" — same rule, broadened trigger.
3. **Complexity/optimization priority**: reword the "for non-trivial algorithms" qualifier in `.claude/CLAUDE(1).md` §16, `.claude/skills/typescript/SKILL.md` (Complexity), `.claude/skills/performance/SKILL.md`, and `.claude/skills/backend-architecture/SKILL.md` to apply to *every implementation*, not just non-trivial ones, and to explicitly prefer the most optimal correct approach.
 
## Verification
 
1. `npm install` (new deps resolve, no native build step for `bcryptjs`).
2. `npm run typecheck` — confirms `Request.user` augmentation compiles and all new files satisfy `strict` TS.
3. `npm run build` — full compile.
4. Manual smoke test: temporarily add two throwaway routes — one behind `requireAuth()`/`requireAuth('ADMIN')`, one behind `optionalAuth` — plus a throwaway `/dev/rotate` route calling `rotateTokens`. Hand-sign tokens with `signAccessToken`/`signRefreshToken` in a scratch script using real `JWT_SECRET`/`JWT_REFRESH_SECRET`, set via `setAuthCookies`/curl `--cookie`. Confirm: no cookie → 401 `AUTH_REQUIRED` on `requireAuth`-guarded route but 200 (no `req.user`) on `optionalAuth`-guarded route; valid access cookie → 200 with `req.user` populated; wrong role on `requireAuth('ADMIN')` → 403 `INSUFFICIENT_ROLE`; expired/garbage access token → 401 `AUTH_TOKEN_EXPIRED`/`AUTH_TOKEN_INVALID`; posting a refresh token as the access cookie → rejected (`type` guard); `/dev/rotate` with a valid refresh cookie → returns a fresh access+refresh pair. Remove the throwaway routes after.
5. `npm run lint`/format if configured.