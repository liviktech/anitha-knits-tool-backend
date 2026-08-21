# Multi-tenant companyId rollout + Company/User management API

## Context

`Company`/`User` already exist and work (signup + login are built: `src/services/authService.ts`, `src/controllers/authController.ts`, mounted at `/api/v1/company/auth`). Every other table — `Brand`, `Chemical`, `Color`, `Size`, `ColorConsumptionStandard`, `WastageType`, `ProductionSetting`, `ProductionRecord`, `WastageRecord`, `ApprovalEvent`, `Inventory`, `LoadSent` — has **no `companyId`**, so all data today is shared globally across every company. No route anywhere applies `requireAuth`/`optionalAuth` yet (confirmed by full grep) — the auth middleware built earlier this session is wired to nothing, and every controller still calls the placeholder `getActor(req)` (reads an `x-user-email` header) instead of `req.user`.

Goal: make every table tenant-scoped by `companyId`, wire `requireAuth` onto every route, replace `getActor` with real JWT-derived identity, and add an ADMIN-only CRUD API for managing MANAGER/SUPERVISOR accounts at `/api/v1/company/user`. Confirmed with the user: full rollout now (schema + every consuming controller/service, not just the schema), full CRUD on the new endpoint, and the dev DB has no real data to preserve (safe to reset/reseed).

## Schema changes (`src/prisma/schema.prisma`)

For each of `Brand`, `Chemical`, `Color`, `Size`, `ColorConsumptionStandard`, `WastageType`, `ProductionRecord`, `WastageRecord`, `ApprovalEvent`, `Inventory`, `LoadSent`: add

```prisma
companyId String @map("company_id") @db.Uuid
company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
```

plus the corresponding back-relation array field on `Company`. Detail tables (`ExtruderDetail`, `LoomDetail`, `FabricCheckDetail`) do **not** get their own `companyId` — they're 1:1 on an already-scoped `ProductionRecord`, matching how `docs/updated-multi-tenant-schema.prisma` treats them.

Uniqueness/index changes that ride along:
- `Brand.name @unique` → `@@unique([companyId, name])`; same for `Chemical.name`, `Color.name`, `Size.name`.
- `WastageType`'s `@@unique([stage, code])` → `@@unique([companyId, stage, code])`; `@@index([stage, isActive])` → `@@index([companyId, stage, isActive])`.
- `ColorConsumptionStandard.colorId @unique` stays as-is (still 1:1 per color row); just add `companyId` + `@@index([companyId])`.
- `ProductionSetting`'s `singleton Boolean @unique @default(true)` is **replaced** with `companyId String @unique @map("company_id") @db.Uuid` (one settings row per company, not a global singleton) — drop `singleton` entirely.
- `ProductionRecord`, `WastageRecord`, `ApprovalEvent`, `Inventory`, `LoadSent`: prefix `companyId` onto their existing composite indexes (e.g. `@@index([stage, productionDate])` → `@@index([companyId, stage, productionDate])`) and add a bare `@@index([companyId])`.

Then run `npx prisma migrate dev --name add_company_id_multitenant` (confirmed OK to reset dev data if the migration needs it).

## `src/prisma/seed.ts`

Every upsert (`brand`, `chemical`, `color`, `size`, `colorConsumptionStandard`, `wastageType`, `productionSetting`) currently keys on a global unique (`name`, `stage_code`, `singleton`) that no longer exists once the above lands — this file won't compile against the new schema, so it must change regardless of anything else. Read a `SEED_COMPANY_ID` env var (throw a clear startup error if unset — "run signup first, then `SEED_COMPANY_ID=<id> npm run prisma:seed`"), add `companyId` to every `create`, and switch each `where` to Prisma's generated compound-unique field (`companyId_name`, `companyId_stage_code`, `companyId` for the settings singleton-replacement). This makes seeding a manual per-company step after signup — building an auto-seed-on-signup feature is out of scope for this pass (flagging it as a natural follow-up, since a newly signed-up company otherwise starts with zero master data and can't create production records yet).

## Reusable auth-context helper (`src/utils/actor.ts`)

Replace `getActor(req)` (the `x-user-email` placeholder, whose own docstring says to do this) with:

```ts
export function getAuthContext(req: Request): { companyId: string; actor: string } {
    if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
    return { companyId: req.user.companyId, actor: req.user.mobile };
}
```

`req.user` comes from `requireAuth` (`src/middlewares/auth.ts`, already built). `actor` stays a `string` so every existing call site's signature (`actor: string`) is unaffected — only the value source changes, from a spoofable header to the verified JWT's mobile.

## Repeated pattern: every consuming service/controller

This exact shape repeats across `extruderService.ts`/`extruderController.ts`, `loomsService.ts`/`loomsController.ts`, `fabricCheckingService.ts`/`fabricCheckingController.ts`, `inventoryService.ts`/`inventoryController.ts`, `loadSentService.ts`/`loadSentController.ts`, `dashboardService.ts`/`dashboardController.ts`, and `lookup.ts` (service+controller). Documented once here rather than file-by-file:

- **Controller**: replace `getActor(req)` with `const { companyId, actor } = getAuthContext(req);`, pass `companyId` as a new argument into every service call (list/get calls that didn't take `actor` before now take `companyId`).
- **Service — create**: add `companyId: string` param; include it directly in the `prisma.<model>.create({ data: { companyId, ... } })` call.
- **Service — list**: add `companyId: string` param; thread into the `where` builder (`buildProductionWhere(stage, query, companyId)` in `src/utils/productionFilters.ts` gets a new param and adds `companyId` to the returned `Prisma.ProductionRecordWhereInput`; the simpler inventory/loadSent/dashboard `where` objects get `companyId` added inline).
- **Service — get/update/approve/reject by id**: add `companyId` to every `findFirst`/`findUnique`/`updateMany` `where` clause alongside `id` (e.g. `where: { id, stage: 'EXTRUDER', companyId }`). This is the critical IDOR fix — today `GET /production/extruder/:id` (and update/approve/reject) trust a bare UUID with no ownership check at all; once auth exists, a user from Company A could otherwise read/edit Company B's record by guessing/observing its id.
- **`masterDataService.ts`**: `assertColorExists`/`assertSizeExists`/`assertBrandExists`/`assertChemicalExists` each gain a `companyId: string` param; switch `findUnique({ where: { id } })` → `findFirst({ where: { id, companyId } })` (matches the existing `findFirst`-for-id+filter pattern already used in `extruderService.ts`). Callers: `extruderService.ts`, `loomsService.ts`, `fabricCheckingService.ts`, `loadSentService.ts`.
- **`wastageService.ts`**: `buildWastageCreates(stage, actor, entries)` gains a `companyId` param; `prisma.wastageType.findUnique({ where: { stage_code: {...} } })` → `where: { companyId_stage_code: { companyId, stage, code } }`; each returned `WastageRecordCreateWithoutProductionRecordInput` gets `companyId` added (the field is now required on `WastageRecord`).
- **`extruderService.ts`'s `resolveColorConsumption`**: unchanged — it looks up `ColorConsumptionStandard` by `colorId`, and that `colorId` is already verified to belong to the caller's company by `assertColorExists(colorId, companyId)` immediately before it runs.

## Route wiring (`src/routes/index.ts`)

Apply `requireAuth()` at the router-mount level (one line per router, not per-handler):

```ts
router.use('/company/user', requireAuth('ADMIN'), userRoutes);
router.use('/production/extruder', requireAuth(), extruderRoutes);
router.use('/production/looms', requireAuth(), loomsRoutes);
router.use('/fabric-checking', requireAuth(), fabricCheckingRoutes);
router.use('/lookups', requireAuth(), lookupRoutes);
router.use('/dashboard', requireAuth(), dashboardRoutes);
router.use('/inventory', requireAuth(), inventoryRoutes);
router.use('/load-sent', requireAuth(), loadSentRoutes);
```

`/health` and `/company/auth` stay public. Note: this pass applies `requireAuth()` uniformly (any authenticated company user) to the production/master-data routes — it does **not** add per-action role restrictions (e.g. "only MANAGER can approve"), since no role matrix for those actions was specified. That's a natural, separate follow-up once that matrix is defined; the new `/company/user` endpoint is the one place a role (`ADMIN`) is enforced, per this task's explicit ask.

## New feature: `/api/v1/company/user` (ADMIN-only CRUD for MANAGER/SUPERVISOR accounts)

Mirrors the existing `/company/auth` file layout exactly.

- **`src/validations/userValidation.ts`**: `createUserSchema` (`name?`, `mobile` — same regex as `authValidation.ts`, `password`, `role: z.enum(['MANAGER','SUPERVISOR'])` — deliberately excludes `ADMIN`/`EMPLOYEE`, matching "creating manager/supervisors"), `updateUserSchema` (partial `name`/`role`/`isActive`, no password field — a password-reset flow is a separate concern), `listUsersQuerySchema` (reuses `paginationSchema` from `src/utils/pagination.ts`, plus optional `role`/`isActive` filters), `userIdParamsSchema`.
- **`src/services/userService.ts`**: `createManagedUser(input, companyId)`, `listUsers(query, companyId)`, `getUserById(id, companyId)`, `updateUser(id, input, companyId)`, `deleteUser(id, companyId, actingUserId)`. Reuses `hashPassword` (`src/utils/password.ts`) and an adapted `mapUniqueConstraintError`-style P2002 handler (from `authService.ts`) for the `@@unique([companyId, mobile])` conflict. `deleteUser` **soft-deletes** (`isActive: false`) rather than a hard row delete — reversible, matches the field's existing purpose, avoids inventing a restore path. Both `updateUser` and `deleteUser` reject `id === actingUserId` (`ConflictError`, `CANNOT_MODIFY_SELF`) so an admin can't lock themselves out. All Prisma calls scope `where` by both `id` and `companyId`, same IDOR-prevention pattern as above. Response selects explicitly list fields (never return `passwordHash`), same as `authService.ts`'s `adminUserSelect`.
- **`src/controllers/userController.ts`**: thin wrappers using `asyncHandler`, `parseOrThrow`, `sendSuccess`, `getAuthContext(req)` for `companyId`, and `req.user!.sub` for the self-modify guard — same shape as every other controller in the repo.
- **`src/routes/userRoutes.ts`**: `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` — no per-route middleware needed since `requireAuth('ADMIN')` is applied once at the mount point in `routes/index.ts` (see above).

## Verification

1. `npx prisma migrate dev --name add_company_id_multitenant` — applies the schema change to the Neon dev DB.
2. `npm run typecheck` / `npm run build` — every touched file (schema-derived types ripple through `masterDataService.ts`, `wastageService.ts`, `productionFilters.ts`, all six feature services, `seed.ts`) must compile clean.
3. `SEED_COMPANY_ID=<id> npm run prisma:seed` after creating a company via `POST /api/v1/company/auth/signup`, to confirm the reworked seed script runs.
4. Manual smoke test (same pattern as the earlier JWT middleware verification): signup two companies, login each, confirm `/production/extruder` list/create/get for Company A never returns/accepts Company B's ids or records; confirm `/company/user` create/list/update/delete works for an ADMIN token and 403s for a MANAGER/SUPERVISOR token; confirm unauthenticated requests to any newly-guarded route 401.
5. `npm run lint`/format if configured.
