import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { sql } from 'kysely';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { type AppDatabase, createDatabase } from '../src/persistence/kysely/database';
import { migrateToLatest } from '../src/persistence/kysely/migrator';
import { seedDatabase } from '../src/persistence/kysely/seed/seed';
import { hashPassword } from '../src/shared/crypto';
import { HttpExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';

const TEST_URL = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
process.env['JWT_SECRET'] ??= 'test-only-secret-minimum-32-characters-long';
process.env['DATABASE_URL'] = TEST_URL ?? 'postgres://oses:oses_dev_pw@localhost:5432/oses_test';

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
  let db: AppDatabase;
  const server = () => app.getHttpServer();
  const login = (body: { email: string; password: string }) =>
    request(server()).post('/api/v1/auth/login').send(body);

  beforeAll(async () => {
    db = createDatabase(process.env['DATABASE_URL'] as string);
    await migrateToLatest(db);
    await sql`truncate table users, sessions, auth_audit_log, user_invitations, password_reset_tokens, mfa_recovery_codes, role_grants, roles, permissions restart identity cascade`.execute(
      db,
    );
    await seedDatabase(db, { superAdmin: SUPER });
    await db
      .insertInto('users')
      .values({
        email: CHECKER.email,
        password_hash: await hashPassword(CHECKER.password),
        role_id: 'role_checker',
        full_name: 'Evaluator One',
        status: 'active',
      })
      .execute();

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
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
});
