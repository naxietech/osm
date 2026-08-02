import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { configureApp } from '../src/app-setup';
import { AppModule } from '../src/app.module';
import { createDataSource } from '../src/persistence/typeorm/data-source';
import { UserEntity } from '../src/persistence/typeorm/entities';
import { seedDatabase } from '../src/persistence/typeorm/seed/seed';
import { hashPassword } from '../src/shared/crypto';

const TEST_URL = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
process.env['DATABASE_URL'] = TEST_URL ?? 'postgres://oses:oses_dev_pw@localhost:5433/oses_test';

const SUPER = {
  email: 'superadmin@oses.pk',
  password: 'test-password-strong-123',
  fullName: 'System Administrator',
};
const CHECKER = { email: 'checker@oses.pk', password: 'checker-strong-pass-123' };
const describeDb = TEST_URL ? describe : describe.skip;

/** Pull a cookie value out of a Set-Cookie response header. */
function cookieValue(res: request.Response, name: string): string {
  const raw = (res.headers['set-cookie'] ?? []) as unknown as string[];
  const found = raw.find((c) => c.startsWith(`${name}=`));
  if (!found) throw new Error(`cookie ${name} not set`);
  const pair = found.split(';')[0] ?? '';
  return pair.slice(pair.indexOf('=') + 1);
}

describeDb('Auth sessions (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const server = () => app.getHttpServer();
  const login = (body: { email: string; password: string }) =>
    request(server()).post('/api/v1/auth/login').send(body);

  beforeAll(async () => {
    dataSource = createDataSource(process.env['DATABASE_URL'] as string);
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.query(
      'truncate table users, sessions, auth_audit_log, role_grants, roles, permissions restart identity cascade',
    );
    await seedDatabase(dataSource, { superAdmin: SUPER });
    await dataSource.getRepository(UserEntity).save(
      dataSource.getRepository(UserEntity).create({
        email: CHECKER.email,
        passwordHash: await hashPassword(CHECKER.password),
        roleId: 'role_checker',
        fullName: 'Evaluator One',
        status: 'active',
      }),
    );

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await dataSource.destroy();
  });

  // ---- hardening: security headers (helmet) ----
  it('sets security headers and hides the framework banner', async () => {
    const res = await login(SUPER);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  // ---- login ----
  it('rejects an invalid payload with 400', () =>
    login({ email: 'x', password: '123' }).expect(400));
  it('rejects an unknown account with 401', () =>
    login({ email: 'nobody@oses.pk', password: 'whatever12' }).expect(401));
  it('rejects the wrong password with 401', () =>
    login({ email: SUPER.email, password: 'the-wrong-password' }).expect(401));

  it('logs in the Super Admin: sets HttpOnly cookies, returns the user, no tokens in body', async () => {
    const res = await login(SUPER).expect(200);
    expect(res.body.data.email).toBe(SUPER.email);
    expect(res.body.data.roleId).toBe('role_super_admin');
    expect(res.body.data).not.toHaveProperty('tokens');
    const joined = ((res.headers['set-cookie'] ?? []) as unknown as string[]).join(' ; ');
    expect(joined).toMatch(/oses_access=/);
    expect(joined).toMatch(/oses_refresh=/);
    expect(joined).toMatch(/HttpOnly/i);
  });

  // ---- /me (cookie auth) ----
  it('GET /me with the access cookie returns the SafeUser', async () => {
    const res = await login(SUPER).expect(200);
    const access = cookieValue(res, 'oses_access');
    const me = await request(server())
      .get('/api/v1/auth/me')
      .set('Cookie', `oses_access=${access}`)
      .expect(200);
    expect(me.body.data.email).toBe(SUPER.email);
  });

  it('GET /me without a cookie returns 401', () =>
    request(server()).get('/api/v1/auth/me').expect(401));

  // ---- RBAC: /permissions resolves grants per role ----
  const permissionsFor = async (creds: { email: string; password: string }): Promise<string[]> => {
    const res = await login(creds).expect(200);
    const access = cookieValue(res, 'oses_access');
    const perms = await request(server())
      .get('/api/v1/auth/permissions')
      .set('Cookie', `oses_access=${access}`)
      .expect(200);
    return (perms.body.data as { action: string }[]).map((g) => g.action).sort();
  };

  it('Super Admin permissions include students.viewPII and roles.manage', async () => {
    const actions = await permissionsFor(SUPER);
    expect(actions).toContain('students.viewPII');
    expect(actions).toContain('roles.manage');
  });

  it('an Evaluator sees only marking.mark + dashboard.view — no PII (anonymity at the API)', async () => {
    expect(await permissionsFor(CHECKER)).toEqual(['dashboard.view', 'marking.mark']);
  });

  it('GET /permissions without a cookie returns 401', () =>
    request(server()).get('/api/v1/auth/permissions').expect(401));

  // ---- refresh rotation + reuse detection ----
  it('POST /refresh rotates the tokens and sets new cookies', async () => {
    const res = await login(SUPER).expect(200);
    const refresh = cookieValue(res, 'oses_refresh');
    const rotated = await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `oses_refresh=${refresh}`)
      .expect(200);
    const joined = ((rotated.headers['set-cookie'] ?? []) as unknown as string[]).join(' ; ');
    expect(joined).toMatch(/oses_access=/);
    expect(joined).toMatch(/oses_refresh=/);
  });

  it('POST /refresh without a cookie returns 401', () =>
    request(server()).post('/api/v1/auth/refresh').expect(401));

  it('detects refresh-token reuse and revokes the whole family', async () => {
    const res = await login(SUPER).expect(200);
    const oldRefresh = cookieValue(res, 'oses_refresh');
    const first = await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `oses_refresh=${oldRefresh}`)
      .expect(200);
    const newRefresh = cookieValue(first, 'oses_refresh');

    // replaying the retired token is treated as theft → 401
    await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `oses_refresh=${oldRefresh}`)
      .expect(401);
    // and the family is now revoked, so even the fresh token is dead
    await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `oses_refresh=${newRefresh}`)
      .expect(401);
  });

  // ---- logout ----
  it('logout revokes the session so its refresh token stops working', async () => {
    const res = await login(SUPER).expect(200);
    const refresh = cookieValue(res, 'oses_refresh');
    await request(server())
      .post('/api/v1/auth/logout')
      .set('Cookie', `oses_refresh=${refresh}`)
      .expect(200);
    await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `oses_refresh=${refresh}`)
      .expect(401);
  });

  // ---- Step 5: user management (RBAC) + password change ----
  describe('user management + password change', () => {
    const STAFF = { email: 'staff@oses.pk', password: 'temp-pass-1234' };
    const NEW_PW = 'new-strong-pass-1';
    let staffId: string;

    const accessFor = async (creds: { email: string; password: string }): Promise<string> =>
      cookieValue(await login(creds).expect(200), 'oses_access');

    it('Super Admin (has users.manage) creates a user', async () => {
      const access = await accessFor(SUPER);
      const res = await request(server())
        .post('/api/v1/users')
        .set('Cookie', `oses_access=${access}`)
        .send({
          email: STAFF.email,
          fullName: 'Staff Member',
          roleId: 'role_admin',
          password: STAFF.password,
        })
        .expect(201);
      expect(res.body.data.email).toBe(STAFF.email);
      expect(res.body.data.roleId).toBe('role_admin');
      staffId = res.body.data.id as string;
    });

    it('an Evaluator (no users.manage) is forbidden — 403', async () => {
      const access = await accessFor(CHECKER);
      await request(server())
        .post('/api/v1/users')
        .set('Cookie', `oses_access=${access}`)
        .send({
          email: 'nope@oses.pk',
          fullName: 'Nope',
          roleId: 'role_admin',
          password: 'temp-pass-1234',
        })
        .expect(403);
    });

    /**
     * `users.id` is a uuid column, so an id of the wrong shape never reached a row lookup —
     * Postgres rejected the query itself ("invalid input syntax for type uuid") and the
     * global filter turned that into a 500 claiming the server was broken. It also wrote a
     * stack trace to the error log for a request that was never a server fault, which is how
     * genuine 500s get lost. Both id routes must answer 404, as they document.
     */
    it('answers 404 — not 500 — for an id that is not a uuid', async () => {
      const access = await accessFor(SUPER);
      await request(server())
        .patch('/api/v1/users/not-a-uuid/status')
        .set('Cookie', `oses_access=${access}`)
        .send({ status: 'suspended' })
        .expect(404);

      await request(server())
        .post('/api/v1/users/not-a-uuid/reset-password')
        .set('Cookie', `oses_access=${access}`)
        .send({ password: 'temp-pass-1234' })
        .expect(404);
    });

    it('rejects a duplicate email — 409', async () => {
      const access = await accessFor(SUPER);
      await request(server())
        .post('/api/v1/users')
        .set('Cookie', `oses_access=${access}`)
        .send({
          email: STAFF.email,
          fullName: 'Dupe',
          roleId: 'role_admin',
          password: 'temp-pass-1234',
        })
        .expect(409);
    });

    it('the new user logs in with the temp password and changes it', async () => {
      const access = cookieValue(await login(STAFF).expect(200), 'oses_access');
      // wrong current → 400
      await request(server())
        .post('/api/v1/auth/password/change')
        .set('Cookie', `oses_access=${access}`)
        .send({ currentPassword: 'wrong', newPassword: NEW_PW })
        .expect(400);
      // correct → 200
      await request(server())
        .post('/api/v1/auth/password/change')
        .set('Cookie', `oses_access=${access}`)
        .send({ currentPassword: STAFF.password, newPassword: NEW_PW })
        .expect(200);
      // old temp no longer works; the new password does
      await login(STAFF).expect(401);
      await login({ email: STAFF.email, password: NEW_PW }).expect(200);
    });

    it('admin reset gives the user a fresh temp password', async () => {
      const access = await accessFor(SUPER);
      await request(server())
        .post(`/api/v1/users/${staffId}/reset-password`)
        .set('Cookie', `oses_access=${access}`)
        .send({ password: 'reset-pass-9999' })
        .expect(200);
      await login({ email: STAFF.email, password: NEW_PW }).expect(401);
      await login({ email: STAFF.email, password: 'reset-pass-9999' }).expect(200);
    });

    it('suspending the user blocks their login', async () => {
      const access = await accessFor(SUPER);
      await request(server())
        .patch(`/api/v1/users/${staffId}/status`)
        .set('Cookie', `oses_access=${access}`)
        .send({ status: 'suspended' })
        .expect(200);
      await login({ email: STAFF.email, password: 'reset-pass-9999' }).expect(401);
    });

    it('GET /users lists users for a Super Admin; forbids an Evaluator', async () => {
      const superAccess = await accessFor(SUPER);
      const res = await request(server())
        .get('/api/v1/users')
        .set('Cookie', `oses_access=${superAccess}`)
        .expect(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
      const superRow = (res.body.data.items as { email: string; status: string }[]).find(
        (u) => u.email === SUPER.email,
      );
      expect(superRow).toBeDefined();
      expect(superRow?.status).toBe('active');
      expect(superRow).toHaveProperty('lastLoginAt');
      expect(superRow).not.toHaveProperty('password_hash');

      const checkerAccess = await accessFor(CHECKER);
      await request(server())
        .get('/api/v1/users')
        .set('Cookie', `oses_access=${checkerAccess}`)
        .expect(403);
    });

    it('GET /roles returns the role catalogue for a Super Admin; forbids an Evaluator', async () => {
      const superAccess = await accessFor(SUPER);
      const res = await request(server())
        .get('/api/v1/roles')
        .set('Cookie', `oses_access=${superAccess}`)
        .expect(200);
      const roles = res.body.data as { id: string; grants: { action: string }[] }[];
      expect(roles).toHaveLength(5);
      const evaluator = roles.find((r) => r.id === 'role_checker');
      expect(evaluator?.grants.map((g) => g.action).sort()).toEqual([
        'dashboard.view',
        'marking.mark',
      ]);

      const checkerAccess = await accessFor(CHECKER);
      await request(server())
        .get('/api/v1/roles')
        .set('Cookie', `oses_access=${checkerAccess}`)
        .expect(403);
    });
  });
});
