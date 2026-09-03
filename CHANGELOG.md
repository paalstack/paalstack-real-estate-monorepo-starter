# Real Estate Starter — Change Log

A trace of every design decision applied to this starter, in order.

## Round 21 — 2026-09-03 — Rename SUPER_ADMIN → OWNER

Same rename as shadhil-crm Round 21. The org-owner role moves from
`SUPER_ADMIN` to `OWNER` (matches the way clients describe the
bootstrapping account). No semantic change to the role — same rank
(top of hierarchy), same uniqueness invariant (exactly one exists),
same RLS downcast behavior.

**Migrations replaced (delete deleted-and-recreated):**

- `20260101010000_role_super_admin` → `20260101010000_role_owner`
  (`ALTER TYPE "Role" ADD VALUE 'OWNER' BEFORE 'ADMIN'`)
- `20260101010100_one_super_admin_index` → `20260101010100_bootstrap_owner`
  (`UPDATE "User" SET "role" = 'OWNER' WHERE "email" = 'owner@example.in'`)
- (new) `20260101010200_one_owner_only` — partial unique index
  `one_owner` renamed, WHERE clause flipped to `'OWNER'`.

**Renamed in code:**

`prisma/schema.prisma` enum Role, `packages/database/src/rls.ts`
local Role union + `ROLES` + downcast, `packages/database/src/seed.ts`,
`packages/auth-client/src/{auth.ts,jwt.ts}`,
`packages/api-types/src/{enums.ts,auth.ts}`,
`apps/backend/src/users/{roles.ts,users.service.ts,users.controller.ts}`,
`apps/web/src/{lib/session.ts,apis/client.ts}`.

**Env vars:** `SEED_ADMIN_*` was a latent bug (code looked up
`SEED_${prefix}_*` with `prefix === 'SUPER_ADMIN'` so the env was
unreachable). Now `SEED_OWNER_*` for the OWNER row.

**Verification:** all 6 workspaces type-check clean (DB + api-types +
auth-client + offline-store + backend + web). `@starter/auth` tests
11/11 pass.

## Round 22 — 2026-09-03 — Seed: add ADMIN placeholder

Same as shadhil-crm Round 22. After Round 21, the only seed user with
admin-class powers was the OWNER (`owner@example.in`). A second
ADMIN placeholder was added (`admin@example.in`) so the OWNER isn't
the only account that can create managers + admins out of the box.

**Changes:**

- `packages/database/src/seed.ts` — `readSeedUser` prefix union now
  includes `'ADMIN'`. Fallback email/name/password replaced with three
  `Record<typeof prefix, string>` lookup tables (cleaner than the
  chained ternary that would have been needed to slot ADMIN in).
  `main()` calls `readSeedUser('ADMIN')`, then `upsertUser(admin,
  'ADMIN')` (no team — same shape as the OWNER row).
- `packages/database/.env.example` and `.env.example` — new
  `SEED_ADMIN_*` block.

## Round 23 — 2026-09-03 — Seed: align emails with role names

Same as shadhil-crm Round 23. The starter's existing emails used
`admin@example.in` for OWNER. After Round 22 added ADMIN, the
collision-avoidance tactic would have parked ADMIN at `admin2@…`.
Cleaner to put each role's email at `<role>@example.in` and reserve
`admin@example.in` for ADMIN.

**Swap:**

- OWNER: `admin@example.in` / `admin_placeholder_pw`
  → `owner@example.in` / `owner_placeholder_pw`
- ADMIN: `admin2@example.in` / `admin2_placeholder_pw`
  → `admin@example.in` / `admin_placeholder_pw`

**Changes:** seed.ts FALLBACK_EMAIL / FALLBACK_PASSWORD records,
packages/database/.env.example, .env.example, README.md seat table.

## Round 24 — 2026-09-03 — Fix `pn db:migrate` "Connection url is empty"

Same as shadhil-crm Round 24. Prisma 7's CLI does NOT auto-load `.env`
for `prisma.config.ts`. Without an explicit loader,
`DIRECT_DATABASE_URL` arrives empty and Prisma fails with
"Connection url is empty".

**Fix:** `packages/database/prisma.config.ts` — added
`loadDotenv({ path: resolve(__dirname, '..', '..', '.env') })`
anchored to the config file (not CWD, which pnpm filter changes).
Uses `dotenv` already in devDeps.

**Verification:** `pnpm db:migrate` in `env -i HOME=… PATH=…` fresh
shell now prints `◇ injected env (13) from ../../.env` then
`Already in sync, no schema change or pending migration was found.`

## Round 25 — 2026-09-03 — Fix login: starter_app GRANTs missing

Same as shadhil-crm Round 25. Two GRANTs were missing:

1. **Schema-level USAGE + CREATE on `public`** — without these, the
   table-level GRANTs are invisible to the role and Postgres returns
   `42501 permission denied for schema public` (or `42P01 relation
   does not exist`).
2. **Table-level CRUD on `Jwks`** — the init migration created the
   `Jwks` table without GRANTs. Better-auth's `jwt()` plugin reads/
   writes `Jwks` on the pooled URL, so every `/api/auth/get-session`
   failed with `42501 permission denied for table Jwks`.

**Changes:**

- `docker/postgres-init/00-init.sql` — added `GRANT USAGE, CREATE
  ON SCHEMA public TO starter_app;`
- `packages/database/prisma/migrations/20260101010300_schema_grants_for_app_role/migration.sql`
  (new) — same GRANT + `GRANT … ON "Jwks"` applied via the
  migration system to the live DB.
- `packages/database/prisma/rls/policies.sql` — canonical source
  updated with both GRANTs (so a future `psql -f policies.sql`
 lands
  them too).

## Round 26 — 2026-09-03 — Drop `retryDelay` function from defaults

Same as shadhil-crm Round 26. TanStack Query's
`qc.getQueryCache().getAll()` returns full Query objects including
`options.queryFn` / `retryDelay` / etc. IndexedDB's `structuredClone`
refuses them. The starter didn't have a persister wired up yet, but
the `retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex,
30000)` function in `apps/web/src/lib/query-client/lib.ts` was the
same foot-gun — the moment anyone added an IDB persister it would
hit the same `DataCloneError`. TanStack's built-in default is the
same exponential backoff, so the override was redundant.

**Change:** `apps/web/src/lib/query-client/lib.ts` — removed the
custom `retryDelay` from `queryClient.defaultOptions.queries`. If a
persister is added later, use `dehydrate()` / `hydrate()` from
`@tanstack/react-query` (they strip non-cloneable fields by design).

## Round 27 — 2026-09-03 — Build/Docker: workspace packages → CJS

The starter had `"type": "module"` on all workspace packages but
NestJS emitted CJS, so `node apps/backend/dist/main.js` would
`require('@starter/database')` and resolve to a package with
`main: ./src/index.ts` (raw TS) — Node CJS can't `require()` `.ts`
files. Same bug shadhil-crm hit earlier.

**Fix (mirrors shadhil-crm's CJS pattern):**

- Dropped `"type": "module"` from `@starter/database`,
  `@starter/auth-client`, `@starter/api-types`, `@starter/offline-store`.
- Changed `main` / `types` / `exports` to `./dist/index.js` +
  `./dist/index.d.ts` (with proper conditional exports for `require`
  / `import` / `default`).
- Added `files: ["dist", "src", "README.md"]` to each package.
- Added `tsconfig.build.json` per package with
  `module: commonjs`, `moduleResolution: node`, `outDir: dist`,
  `rootDir: src`, `noEmit: false`. (Distinct from the existing
  `tsconfig.json` which has `noEmit: true` for type-check.)
- Changed each `build` script to `tsc -p tsconfig.build.json`
  (database's chain: `… && prisma generate`).

**Dockerfile updated:** the build stage now runs `pnpm build`
(fanning out through turbo's `^build` dep graph) so packages are
built in dependency order before `nest build` runs. The production
stage copies each package's `dist/` (already done; the previous
Dockerfile comment claimed "the dist lives in packages/" but no
package was actually emitting one until Round 27).

**Verification:** all four packages build clean to CJS:

```
$ pnpm --filter @starter/database build
$ pnpm --filter @starter/auth-client build
$ pnpm --filter @starter/api-types build
$ pnpm --filter @starter/offline-store build
```

`apps/backend/dist/main.js` now starts with `"use strict"; const
core_1 = require("@nestjs/core"); const database_1 =
require("@starter/database");` — pure CJS, no ESM/CJS mismatch. The
dist files exist at the paths the consumer package.jsons point at.

**Type-check:** all 6 workspaces clean (`packages/database`,
`packages/api-types`, `packages/auth-client`,
`packages/offline-store`, `apps/backend`, `apps/web`).

**Lesson (for the next agent adding a new workspace package):**

- `"type": "module"` is incompatible with `nest build` unless
  you also switch backend to ESM (which has its own sharp edges
  around the directory-import bug + `.js` import suffixes). The
  CJS path is the smaller change for a NestJS monorepo.
- The `build` script must end with an emit, not a `prisma
 generate` shortcut, or downstream consumers' `import` resolves
  to a package whose `dist/` doesn't exist.