import { type DataSource } from 'typeorm';

import { createDataSource } from '../src/persistence/typeorm/data-source';
import {
  PermissionEntity,
  RoleEntity,
  RoleGrantEntity,
  UserEntity,
} from '../src/persistence/typeorm/entities';
import { seedDatabase } from '../src/persistence/typeorm/seed/seed';
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
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = createDataSource(TEST_URL as string);
    await dataSource.initialize();
    await dataSource.runMigrations();
    // deterministic start
    await dataSource.query(
      'truncate table users, sessions, auth_audit_log, role_grants, roles, permissions restart identity cascade',
    );
    await seedDatabase(dataSource, { superAdmin: SUPER });
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('seeds the full permission catalogue', async () => {
    expect(await dataSource.getRepository(PermissionEntity).count()).toBe(
      ALL_PERMISSION_ACTIONS.length,
    );
  });

  it('seeds the five system roles', async () => {
    const rows = await dataSource.getRepository(RoleEntity).find();
    expect(rows.map((r) => r.id).sort()).toEqual(Object.values(SYSTEM_ROLE_IDS).sort());
  });

  it('Evaluator grants are exactly marking.mark + dashboard.view — no PII', async () => {
    // Grants point at a permission id now, so the readable action comes from a join.
    const rows = await dataSource
      .getRepository(RoleGrantEntity)
      .createQueryBuilder('grant')
      .innerJoin(PermissionEntity, 'permission', 'permission.id = grant.permissionId')
      .select('permission.action', 'action')
      .where('grant.roleId = :roleId', { roleId: SYSTEM_ROLE_IDS.checker })
      .getRawMany<{ action: string }>();

    expect(rows.map((r) => r.action).sort()).toEqual(['dashboard.view', 'marking.mark']);
    expect(rows.map((r) => r.action)).not.toContain('students.viewPII');
  });

  it('gives every role a uuid id and a readable code', async () => {
    const rows = await dataSource.getRepository(RoleEntity).find();

    expect(rows.every((r) => /^[0-9a-f-]{36}$/.test(r.id))).toBe(true);
    expect(rows.map((r) => r.code).sort()).toEqual([
      'admin',
      'checker',
      'controller',
      'institute',
      'super_admin',
    ]);
  });

  it('gives every permission a uuid id while keeping the action as a unique code', async () => {
    const rows = await dataSource.getRepository(PermissionEntity).find();

    expect(rows).toHaveLength(ALL_PERMISSION_ACTIONS.length);
    expect(rows.every((p) => /^[0-9a-f-]{36}$/.test(p.id))).toBe(true);
    expect(new Set(rows.map((p) => p.action)).size).toBe(rows.length);
  });

  it('bootstraps an active Super Admin with a verifiable argon2id hash', async () => {
    const user = await dataSource.getRepository(UserEntity).findOneByOrFail({ email: SUPER.email });

    expect(user.status).toBe('active');
    expect(user.roleId).toBe(SYSTEM_ROLE_IDS.superAdmin);
    expect(user.passwordHash?.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(user.passwordHash as string, SUPER.password)).resolves.toBe(true);
    await expect(verifyPassword(user.passwordHash as string, 'wrong-password')).resolves.toBe(
      false,
    );
  });

  it('is idempotent — re-seeding creates no duplicate Super Admin', async () => {
    const again = await seedDatabase(dataSource, { superAdmin: SUPER });
    expect(again.superAdminCreated).toBe(false);
    expect(await dataSource.getRepository(UserEntity).count()).toBe(1);
  });

  it('reconciles a drifted password back to .env and clears any lockout (no more drift)', async () => {
    // Simulate the exact failure the fix targets: the stored hash drifted (a valid argon2id
    // hash of some OTHER string) and the account got locked.
    const driftedHash =
      '$argon2id$v=19$m=19456,t=2,p=1$LJzkt/dgiA3w7NvkJhN93A$VV9kvzNzl4sLu0STHJWJwUfiT6uzjJ5LDolcUppC6lw';
    await dataSource.getRepository(UserEntity).update(
      { email: SUPER.email },
      {
        passwordHash: driftedHash,
        failedLoginCount: 5,
        lockedUntil: new Date(Date.now() + 900_000),
      },
    );

    const summary = await seedDatabase(dataSource, { superAdmin: SUPER });
    expect(summary.superAdminPasswordReset).toBe(true);

    const user = await dataSource.getRepository(UserEntity).findOneByOrFail({ email: SUPER.email });

    // Password now matches .env again, and the account is unlocked + active.
    await expect(verifyPassword(user.passwordHash as string, SUPER.password)).resolves.toBe(true);
    expect(user.failedLoginCount).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(user.status).toBe('active');
  });
});
