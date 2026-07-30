import { sql } from 'kysely';

import { type AppDatabase, createDatabase } from '../src/persistence/kysely/database';
import { migrateToLatest } from '../src/persistence/kysely/migrator';
import { seedDatabase } from '../src/persistence/kysely/seed/seed';
import { ALL_PERMISSION_ACTIONS } from '../src/rbac/permissions.constants';
import { SYSTEM_ROLE_IDS } from '../src/rbac/system-roles';
import { verifyPassword } from '../src/shared/crypto';

// Integration test — needs a reachable Postgres. Point DATABASE_URL_TEST (or DATABASE_URL)
// at the oses_test database. Skips cleanly when neither is set.
const TEST_URL = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
const SUPER = {
  email: 'superadmin@oses.pk',
  password: 'test-password-strong-123',
  fullName: 'System Administrator',
};

const describeDb = TEST_URL ? describe : describe.skip;

describeDb('auth persistence + seed (integration)', () => {
  let db: AppDatabase;

  beforeAll(async () => {
    db = createDatabase(TEST_URL as string);
    await migrateToLatest(db);
    // deterministic start
    await sql`truncate table users, sessions, auth_audit_log, role_grants, roles, permissions restart identity cascade`.execute(
      db,
    );
    await seedDatabase(db, { superAdmin: SUPER });
  });

  afterAll(async () => {
    await db.destroy();
  });

  const countOf = async (table: 'permissions' | 'users'): Promise<number> => {
    const row = await db
      .selectFrom(table)
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  };

  it('seeds the full permission catalogue', async () => {
    expect(await countOf('permissions')).toBe(ALL_PERMISSION_ACTIONS.length);
  });

  it('seeds the five system roles', async () => {
    const rows = await db.selectFrom('roles').select('id').execute();
    expect(rows.map((r) => r.id).sort()).toEqual(Object.values(SYSTEM_ROLE_IDS).sort());
  });

  it('Evaluator grants are exactly marking.mark + dashboard.view — no PII', async () => {
    const rows = await db
      .selectFrom('role_grants')
      .select(['action'])
      .where('role_id', '=', SYSTEM_ROLE_IDS.checker)
      .execute();
    expect(rows.map((r) => r.action).sort()).toEqual(['dashboard.view', 'marking.mark']);
    expect(rows.map((r) => r.action)).not.toContain('students.viewPII');
  });

  it('bootstraps an active Super Admin with a verifiable argon2id hash', async () => {
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', SUPER.email)
      .executeTakeFirstOrThrow();

    expect(user.status).toBe('active');
    expect(user.role_id).toBe(SYSTEM_ROLE_IDS.superAdmin);
    expect(user.password_hash?.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(user.password_hash as string, SUPER.password)).resolves.toBe(true);
    await expect(verifyPassword(user.password_hash as string, 'wrong-password')).resolves.toBe(
      false,
    );
  });

  it('is idempotent — re-seeding creates no duplicate Super Admin', async () => {
    const again = await seedDatabase(db, { superAdmin: SUPER });
    expect(again.superAdminCreated).toBe(false);
    expect(await countOf('users')).toBe(1);
  });

  it('reconciles a drifted password back to .env and clears any lockout (no more drift)', async () => {
    // Simulate the exact failure the fix targets: the stored hash drifted (a valid argon2id
    // hash of some OTHER string) and the account got locked.
    const driftedHash =
      '$argon2id$v=19$m=19456,t=2,p=1$LJzkt/dgiA3w7NvkJhN93A$VV9kvzNzl4sLu0STHJWJwUfiT6uzjJ5LDolcUppC6lw';
    await db
      .updateTable('users')
      .set({
        password_hash: driftedHash,
        failed_login_count: 5,
        locked_until: new Date(Date.now() + 900_000),
      })
      .where('email', '=', SUPER.email)
      .execute();

    const summary = await seedDatabase(db, { superAdmin: SUPER });
    expect(summary.superAdminPasswordReset).toBe(true);

    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', SUPER.email)
      .executeTakeFirstOrThrow();

    // Password now matches .env again, and the account is unlocked + active.
    await expect(verifyPassword(user.password_hash as string, SUPER.password)).resolves.toBe(true);
    expect(user.failed_login_count).toBe(0);
    expect(user.locked_until).toBeNull();
    expect(user.status).toBe('active');
  });
});
