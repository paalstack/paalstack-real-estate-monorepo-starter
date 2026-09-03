# Multi-stage NestJS Dockerfile for Real Estate Starter.
# Phase 1: scaffold only. Real production tuning lands in Week 12.
#
# Round 21+ / Docker-build followup (2026-09-03):
# The workspace packages (database, auth-client, api-types,
# offline-store) now emit CJS `dist/` from their `build` script and
# their `package.json#main` points at `dist/index.js`. Nest's
# `nest build` reads the workspace symlinks from `node_modules`
# and resolves `@starter/database` etc. through the symlink to
# the package's compiled CJS — no raw `.ts` `require()`, no
# `ERR_REQUIRE_ESM`. The build stage must run the package
# `build` scripts BEFORE `nest build` so the dists exist when
# Nest's compiler resolves the imports.

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

# Copy workspace files first (better layer caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy all packages and apps
COPY packages/ packages/
COPY apps/backend/ apps/backend/

# Install deps
RUN pnpm install --frozen-lockfile

# Generate Prisma client + build all workspace packages (emits
# dist/ with CJS output for each). pnpm build fans out through
# turbo's `^build` dep graph so packages are built in dependency
# order before apps.
RUN pnpm --filter @starter/database generate
RUN pnpm build

# Build the NestJS app (reads the now-built workspace packages
# from their dist/index.js exports).
RUN pnpm --filter @starter/backend build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

# Copy only the built artifacts + runtime deps. Every workspace
# package's dist/ is needed at runtime (the app requires them via
# the symlinked node_modules).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/ packages/
COPY --from=builder /app/apps/backend/dist apps/backend/dist
COPY --from=builder /app/apps/backend/package.json apps/backend/

# The pool-mode requirement: NestJS boot-time check reads this. If not 'session',
# bootstrap throws PoolModeError.
ENV POOL_MODE=session
ENV NODE_ENV=production
ENV API_PORT=8080

EXPOSE 8080

# Non-root user (security hardening — Week 12)
USER node

CMD ["node", "apps/backend/dist/main.js"]