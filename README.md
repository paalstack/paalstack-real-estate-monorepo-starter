# Real Estate Starter

PaalStack internal starter for real-estate CRM products. Monorepo: Next.js 16
web (BFF + UI), NestJS 12 REST API, Expo mobile (Phase 2), Prisma 7 + Postgres 16
with row-level security.

Stack pins: pnpm 11 · Node 22 in CI · Next 16 · Nest 12 · Prisma 7.10
(+ `@prisma/adapter-pg`) · better-auth 1.7 · Tailwind 4 · edoburu/pgbouncer 1.25 ·
Postgres 16 · Redis 7.

## Quick start (target: < 5 min)

```bash
pnpm install
cp .env.example .env          # edit secrets (BETTER_AUTH_SECRET, JWT_SECRET)
pnpm docker:up                # postgres + pgbouncer (session pool) + redis
pnpm --filter @starter/database generate  # prisma client (gitignored)
pnpm --filter @starter/database migrate   # schema + RLS policies + grants
pnpm --filter @starter/database seed      # owner + admin + manager + 2 staff
pnpm dev                      # turbo dev — web :3000, api :8080
```

Then open http://localhost:3000/login and sign in with a seeded placeholder
account (rotate these before any real use):

| Email                 | Role                            | Password                    |
| --------------------- | ------------------------------- | --------------------------- |
| owner@example.in      | OWNER (exactly one, ever)      | `owner_placeholder_pw`      |
| admin@example.in      | ADMIN                           | `admin_placeholder_pw`      |
| manager@example.in    | MANAGER                         | `manager_placeholder_pw`    |
| telecaller@example.in | TELECALLER                      | `telecaller_placeholder_pw` |
| sales_exec@example.in | SALES_EXEC                      | `sales_exec_placeholder_pw` |

Role model: OWNER ⊃ ADMIN ⊃ MANAGER ⊃ TELECALLER / SALES_EXEC. The
owner creates admins; admins create managers + staff; managers create
staff in their own team. Role changes follow the same hierarchy and are
written to the audit log (see `CHANGELOG.md` Rounds 21–27). Users are
created/changed via the API (`POST /api/users`,
`PATCH /api/users/:id/role`) until the admin UI lands.

## Branding a new project

Copies live in `packages/ui-tokens`:

- `src/brand.css` — the only file you edit. Overrides the brand slots
  (`--primary`, `--secondary`, dark-mode variants) on top of the shadcn
  token contract from `@paalstack/react-ui/base.css`.
- `src/compliance.ts` — regulatory disclosure strings (RERA/CMDA-style).
  Replace the env keys + copy for your project, or delete the module if the
  project has no regulatory-disclaimer surface (also drop the export from
  `src/index.ts` and its test).

Rename the workspace packages if you want project-scoped scopes: search for
`@starter/` (workspace scope) and `real-estate-starter` (root package name),
plus the docker role names `starter` / `starter_app` and the `starter_crm`
database name in `docker/`, `.env.example`, and CI. All renames are
find-replace safe.

## Layout

```
apps/
  web/       Next.js 16 (auth-gated UI, better-auth catch-all, BFF proxy)
  backend/   NestJS 12 REST (users, JWT bridge, SSE, crons, webhooks)
  mobile/    Expo (Phase 2 — add when the project needs it)
packages/
  database/  Prisma schema + RLS policies + migrations (single source of truth)
  auth/      @starter/auth — shared better-auth instance + JWT helpers
  api-types/ Zod schemas + inferred types shared across apps
  ui-tokens/ Brand tokens + compliance helpers
```

## Commands

| Command                                    | What it does                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `pnpm docker:up`                           | Start postgres/pgbouncer/redis (edoburu pgbouncer; ini is authoritative) |
| `pnpm --filter @starter/database generate` | Generate the Prisma client (gitignored — required after install)         |
| `pnpm --filter @starter/database migrate`  | Apply schema + RLS (prisma migrate)                                      |
| `pnpm --filter @starter/database seed`     | Owner + admin + manager + team + staff (placeholders unless SEED_* set) |
| `pnpm db:policies`                         | Re-apply policies.sql directly (idempotent)                              |
| `pnpm build`                               | Build every workspace package (`tsc -p tsconfig.build.json`) and the NestJS app (`nest build`). Required before `node apps/backend/dist/main.js` runs — the package `main` fields point at `dist/index.js`. Without this, prod-mode `require('@starter/database')` resolves to a package with no `dist/`.        |
| `pnpm test`                                | All package tests (unit runs anywhere; DB suite needs live Postgres)     |
| `pnpm type-check` / `pnpm lint`            | Gates that must stay green                                               |
| `bash scripts/build-pages.sh`              | Rebuild the docs site locally into `dist-pages/` (needs pandoc)          |

### Dev vs Docker stack

Both `pnpm dev` and `pnpm docker:up` bind ports 3000 (web) and 8080
(api). On the dev loop, workspace packages are built incrementally:

- **For the dev loop (hot-reload, `tsc --watch`):** `pnpm dev` — runs the
  backend via `tsx watch src/main.ts` (raw TS, no CJS needed) and
  the web via `next dev`. Edits to workspace packages are picked up
  directly — `tsx` reads the `.ts` source on each invocation, so
  there's no `dist/` rebuild dance to manage. Faster iteration;
  ships no `dist/` artifacts.
- **For verifying the production image locally (or running on a VPS):**
  `pnpm build && pnpm docker:up` — `pnpm build` fans out through
  turbo's `^build` dep graph, builds every workspace package's
  CJS `dist/`, then builds the NestJS app via `nest build`. The
  multi-stage `apps/backend/Dockerfile` does the same thing on a
  fresh Node 22-alpine base. Required because every package's
  `package.json#main` points at `./dist/index.js` (per Round 27 of
  `CHANGELOG.md`) — `require('@starter/database')` from CJS
  Nest output resolves through the symlinked `node_modules` to
  the package's compiled CJS.

## Docs site (GitHub Pages)

Pushes to `main` publish the repo's own documentation — `README.md` and
`AGENTS.md` — as a static site (`.github/workflows/pages.yml`). Pandoc
converts the markdown at deploy time, so the pages always match the
source. Local preview: `bash scripts/build-pages.sh`, then open
`dist-pages/index.html`.

One-time enablement (a workflow token cannot create the Pages site):
`gh api -X POST repos/<org>/<repo>/pages -f build_type=workflow`, or
Settings -> Pages -> Source: GitHub Actions. Done once for this repo
(made public 2026-08-31; Pages is plan-limited on private repos).

Note: the Next.js app in `apps/web` is deliberately NOT published to
Pages — it is a server-rendered app (better-auth sessions, BFF proxy
routes) and cannot run as static files. It keeps its own deploy target
(`apps/web/vercel.json`). On a private repo, the Pages deploy step also
needs a plan that includes Pages; on free org accounts the fix is to
make the repo public or upgrade.

## Security model (read before touching data access)

- Business tables are **FORCE ROW LEVEL SECURITY**. The API connects as
  `starter_app` (non-owner) — owner role `starter` is migrations/seed only.
- Every request-scoped query MUST run inside
  `withRlsContext(prisma, { userId, role, teamId }, tx => ...)` from
  `@starter/database`. Bare-prisma access bypasses RLS and is reserved for
  migrations, seed, auth tables (User/Session/Account), Team writes
  (RLS-forced with zero policies), and system crons.
- Roles are the Prisma `Role` enum (UPPERCASE): `OWNER | ADMIN |
  MANAGER | SALES_EXEC | TELECALLER`. JWT claims are validated in
  `packages/auth-client/src/jwt.ts` — a token without a valid role claim is
  rejected. Exactly one OWNER exists (partial unique index
  `one_owner`); it cannot be created or assigned through the API.
- `@Public()` is for health, auth, and signature-verified webhooks only.
  Nowhere else.

## Conventions

- Modules live in `apps/backend/src/<module>/` as NestJS `*.module.ts` +
  controllers/services; tests co-locate as `*.test.ts` next to the unit or in
  the package `test/` dir.
- Every new feature ships with tests in the same PR. Backend tests: Vitest +
  supertest; web E2E: Playwright.
- Turbo caches builds — test inputs include all `*.test.ts` files (see
  `turbo.json`). Never exclude tests from cache inputs.
- CI (`.github/workflows/ci.yml`): type-check, lint, unit tests, RLS matrix
  (fresh Postgres service + `prisma generate` per job), build.

## Migration policy

Schema changes flow ONLY through Prisma migrations
(`packages/database/prisma/migrations/`). RLS policy changes belong in the
same migration as the table change — keep `prisma/rls/policies.sql` as the
canonical source and copy into the migration. Postgres-level constraints that
Prisma can't express (e.g. the partial unique index `one_owner`) live
in their own native-SQL migrations.
