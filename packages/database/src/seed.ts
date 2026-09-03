import { randomBytes, scryptSync } from 'node:crypto';
import { prisma } from './index';

// ────────────────────────────────────────────────────────────────────────────
// Real Estate Starter — bootstrap seed.
// Round 21 renamed the org-owner role SUPER_ADMIN → OWNER.
// Round 22 added a second ADMIN placeholder so the OWNER isn't the only
// account that can create managers + admins out of the box.
// Round 23 aligned placeholder emails with role names:
//   OWNER       → owner@example.in
//   ADMIN       → admin@example.in
//   MANAGER     → manager@example.in
//   TELECALLER  → telecaller@example.in
//   SALES_EXEC  → sales_exec@example.in
// Each email mirrors the role name (Round 23) so they're
// discoverable in a fresh clone.
// Credentials are created in the EXACT shape better-auth 1.7 expects at
// sign-in (dist/api/routes/sign-in.mjs:320):
//   account.accountId === user.id  AND  account.issuer === 'local:credential'
// Passwords use @better-auth/utils scrypt params (N=16384, r=16, p=1,
// dkLen=64, NFKC-normalized) stored as "salt:key". Placeholders MUST be
// rotated on first login.
// ────────────────────────────────────────────────────────────────────────────

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const normalized = password.normalize('NFKC');
  const hash = scryptSync(normalized, salt, 64, {
    N: 16384,
    r: 16,
    p: 1,
    maxmem: 128 * 16384 * 16 * 2,
  }).toString('hex');
  return `${salt}:${hash}`;
}

interface SeedUser {
  email: string;
  name: string;
  password: string;
}

function readSeedUser(
  prefix: 'OWNER' | 'ADMIN' | 'MANAGER' | 'TELECALLER' | 'SALES_EXEC',
): SeedUser {
  // Fallback: documented placeholder users per role. Each email mirrors
  // the role name (Round 23 swap from admin/admin2 → owner@/admin@).
  const FALLBACK_EMAIL: Record<typeof prefix, string> = {
    OWNER: 'owner@example.in',
    ADMIN: 'admin@example.in',
    MANAGER: 'manager@example.in',
    TELECALLER: 'telecaller@example.in',
    SALES_EXEC: 'sales_exec@example.in',
  };
  const FALLBACK_NAME: Record<typeof prefix, string> = {
    OWNER: 'Owner',
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    TELECALLER: 'Telecaller',
    SALES_EXEC: 'Sales Exec',
  };
  const FALLBACK_PASSWORD: Record<typeof prefix, string> = {
    OWNER: 'owner_placeholder_pw',
    ADMIN: 'admin_placeholder_pw',
    MANAGER: 'manager_placeholder_pw',
    TELECALLER: 'telecaller_placeholder_pw',
    SALES_EXEC: 'sales_exec_placeholder_pw',
  };

  const email = process.env[`SEED_${prefix}_EMAIL`] ?? FALLBACK_EMAIL[prefix];
  const name = process.env[`SEED_${prefix}_NAME`] ?? `${FALLBACK_NAME[prefix]} (placeholder)`;
  const password = process.env[`SEED_${prefix}_PASSWORD`] ?? FALLBACK_PASSWORD[prefix];

  if (!email || !name || !password) {
    throw new Error(
      `Missing SEED_${prefix}_EMAIL / SEED_${prefix}_NAME / SEED_${prefix}_PASSWORD in env`,
    );
  }

  return { email, name, password };
}

type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'TELECALLER' | 'SALES_EXEC';

/**
 * Upsert user, then upsert the credential account keyed on user.id (the
 * better-auth 1.7 sign-in contract: sign-in.mjs requires
 * account.accountId === user.id && account.issuer === 'local:credential').
 * Password is refreshed on every seed run so re-seeding after a password
 * rotation works.
 */
async function upsertUser(user: SeedUser, role: Role, teamId?: string) {
  const dbUser = await prisma.user.upsert({
    where: { email: user.email },
    update: { role, ...(teamId ? { teamId } : {}) },
    create: {
      email: user.email,
      name: user.name,
      role,
      teamId,
      emailVerified: true,
    },
  });

  await prisma.account.upsert({
    where: {
      providerId_accountId: { providerId: 'credential', accountId: dbUser.id },
    },
    update: { password: hashPassword(user.password), issuer: 'local:credential' },
    create: {
      accountId: dbUser.id,
      providerId: 'credential',
      issuer: 'local:credential',
      userId: dbUser.id,
      password: hashPassword(user.password),
    },
  });

  return dbUser;
}

async function main() {
  // Disable RLS for seed — the bootstrap admin needs to bypass policies until
  // the database is fully populated. In production, run migrations with the
  // DIRECT_DATABASE_URL (owner role), which bypasses RLS by default.
  await prisma.$executeRawUnsafe(`SET LOCAL row_security = off`).catch(() => {
    // session-level fallback if SET LOCAL is not allowed (no active tx)
    return prisma.$executeRawUnsafe(`SET row_security = off`);
  });

  const owner = readSeedUser('OWNER');
  const admin = readSeedUser('ADMIN');
  const manager = readSeedUser('MANAGER');
  const telecaller = readSeedUser('TELECALLER');
  const salesExec = readSeedUser('SALES_EXEC');

  // ── Manager first so we have a teamId ────────────────────────────────────
  const managerUser = await upsertUser(manager, 'MANAGER');

  // ── Team owned by the manager ────────────────────────────────────────────
  const team = await prisma.team.upsert({
    where: { id: `seed-team-${managerUser.id}` },
    update: { managerId: managerUser.id, name: `${manager.name}'s Team` },
    create: {
      id: `seed-team-${managerUser.id}`,
      name: `${manager.name}'s Team`,
      managerId: managerUser.id,
    },
  });

  // ── Owner + Admin (no team), telecaller + sales exec (team members) ──
  await upsertUser(owner, 'OWNER');
  await upsertUser(admin, 'ADMIN');
  await upsertUser(telecaller, 'TELECALLER', team.id);
  await upsertUser(salesExec, 'SALES_EXEC', team.id);

  // eslint-disable-next-line no-console
  console.log('[seed] ✓ owner, admin, manager, telecaller, sales exec created/updated');
  // eslint-disable-next-line no-console
  console.log(`[seed] team: ${team.name} (${team.id})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error('[seed] FAIL:', e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });