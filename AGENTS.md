# AGENTS.md — real-estate-starter

Working conventions for any AI agent or human working in this repo. This is a
generic real-estate CRM starter — keep it generic. No client names, no
client data, no project-specific business copy.

## Stack + layout

- Turborepo + pnpm. Apps: `apps/web` (Next.js 16), `apps/backend` (NestJS 12),
  `apps/mobile` (Expo, when a project needs it). Packages:
  `@starter/database`, `@starter/auth`, `@starter/api-types`,
  `@starter/ui-tokens` (workspace:*).
- Build/dev/lint/type-check/test run through `pnpm <cmd>` (turbo).
- Port allocation: web 3000, api 8080, pgbouncer 6432, postgres 5432, redis 6379.

## Keep it generic

- Do not add client-specific branding, domains, phone numbers, or regulatory
  values. Brand surfaces live in `packages/ui-tokens/src/brand.css` and
  `src/compliance.ts` — placeholder values only.
- Business modules (leads, visits, bookings, chat, reminders, notifications,
  audit, webhooks) are scaffolded stubs in the backend and honest pending
  states in the web UI. When implementing one, keep the contract in
  `packages/api-types` as the single source of truth and implement backend +
  web in the same change.

## Module conventions (backend)

- Feature modules in `apps/backend/src/<module>/<module>.module.ts` with a
  controller + service. Registered in `app.module.ts`.
- **Every business query runs inside `withRlsContext()`** (from
  `@starter/database`) with the request's `{ userId, role, teamId }`. The bare
  `prisma` client is ONLY for: migrations, seed, better-auth session/account
  writes, webhook ingest, system crons. Anything else is a security defect.
- Global guard is JWT (`@Public()` opts out). `@Public()` is allowed ONLY on:
  health probe, auth endpoints, and signature-verified webhook receivers.
  Adding it anywhere else fails review.
- Roles are Prisma enum values (UPPERCASE): `OWNER | ADMIN | MANAGER |
SALES_EXEC | TELECALLER`. Never hand-roll role strings.
- Errors: never swallow. Each module maps its known failure classes to typed
  exceptions (what/why/fix).
- Audit writes for high-stakes actions (reassign, state transitions, booking,
  consent) happen inside the SAME transaction as the action
  (`prisma.$transaction` + `tx`).

## Tests

- Co-locate unit tests as `*.test.ts` beside the code, or in the package
  `test/` dir. Framework: Vitest.
- Backend integration tests: supertest against a Nest app instance; DB-backed
  tests use the live dev DB in CI (rls-matrix job provisions Postgres).
- The RLS matrix (`packages/database/test/rls-isolation.test.ts`) must NEVER
  silently skip: CI sets `RLS_MATRIX_REQUIRED=true`, missing DB = red.
- Every PR ships its own tests and keeps `pnpm lint`,
  `pnpm type-check`, `pnpm test` green.
- Do NOT exclude test files from turbo cache inputs — stale green results are
  worse than no results.

## Database

- Schema changes ONLY via Prisma migrations in
  `packages/database/prisma/migrations/`. Never `db push` past scaffold.
- RLS policy changes: edit `prisma/rls/policies.sql` (canonical), then copy
  the delta into the migration applying it.
- `POOL_MODE=session` is REQUIRED. The boot check enforces it.
- The database user for the app is `starter_app` (non-owner, RLS-enforced).
  The `starter` owner is for migrations/seed only.

## Auth (better-auth)

- Single instance lives in `packages/auth-client/src/auth.ts` (exported as
  `@starter/auth`). Never construct a second `betterAuth()`.
- User model: role is a better-auth additional field with default
  `TELECALLER` (admin plugin defaultRole — never send `role` from signup
  input); `teamId` is input:false (admins assign teams).
- Credential accounts: `accountId = user.id`, `issuer = 'local:credential'`.
  Password hashing must match `@better-auth/utils` scrypt (N=16384, r=16,
  p=1, dkLen=64, NFKC) with format `salt:key` — see seed.ts, which is the
  reference implementation.
- JWT: HS256 shared secret; role claim validated against the enum in
  `verifyJwt` — missing/unknown roles throw (no silent defaults).
