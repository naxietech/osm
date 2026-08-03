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
process.env['JWT_SECRET'] ??= 'test-only-secret-minimum-32-characters-long';
process.env['DATABASE_URL'] = TEST_URL ?? 'postgres://oses:oses_dev_pw@localhost:5432/oses_test';

const SUPER = {
  email: 'superadmin@oses.pk',
  password: 'test-password-strong-123',
  fullName: 'System Administrator',
};
const ADMIN = { email: 'admin-subj@oses.pk', password: 'admin-strong-pass-123' };
const EVALUATOR = { email: 'checker-subj@oses.pk', password: 'checker-strong-pass-123' };

const describeDb = TEST_URL ? describe : describe.skip;

interface Envelope<T> {
  success: boolean;
  data: T;
}
interface SubjectBody {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

const UNKNOWN_ID = '11111111-1111-4111-8111-111111111111';

describeDb('Subjects (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const server = () => app.getHttpServer();

  async function cookieFor(creds: { email: string; password: string }): Promise<string> {
    const res = await request(server()).post('/api/v1/auth/login').send(creds).expect(200);
    const raw = (res.headers['set-cookie'] ?? []) as unknown as string[];
    return raw.map((c) => c.split(';')[0]).join('; ');
  }

  let superCookie: string;
  let adminCookie: string;
  let evaluatorCookie: string;

  beforeAll(async () => {
    dataSource = createDataSource(process.env['DATABASE_URL'] as string);
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.query(
      'truncate table subjects, users, sessions, auth_audit_log, role_grants, roles, permissions restart identity cascade',
    );
    await seedDatabase(dataSource, { superAdmin: SUPER });

    const users = dataSource.getRepository(UserEntity);
    await users.save([
      users.create({
        email: ADMIN.email,
        passwordHash: await hashPassword(ADMIN.password),
        roleId: 'role_admin',
        fullName: 'Admin One',
        status: 'active',
      }),
      users.create({
        email: EVALUATOR.email,
        passwordHash: await hashPassword(EVALUATOR.password),
        roleId: 'role_checker',
        fullName: 'Evaluator One',
        status: 'active',
      }),
    ]);

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    superCookie = await cookieFor(SUPER);
    adminCookie = await cookieFor(ADMIN);
    evaluatorCookie = await cookieFor(EVALUATOR);
  });

  afterAll(async () => {
    await app.close();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query('truncate table subjects restart identity cascade');
  });

  const asSuper = (method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    request(server())[method](`/api/v1${url}`).set('Cookie', superCookie);

  async function createSubject(code: string, name: string): Promise<SubjectBody> {
    const res = await asSuper('post', '/subjects').send({ code, name }).expect(201);
    return (res.body as Envelope<SubjectBody>).data;
  }

  describe('permissions', () => {
    it('refuses an anonymous caller', async () => {
      await request(server()).get('/api/v1/subjects').expect(401);
    });

    it('refuses an Evaluator — no subjects.manage grant', async () => {
      await request(server()).get('/api/v1/subjects').set('Cookie', evaluatorCookie).expect(403);
    });

    it('refuses an Admin — reference data is Super Admin only', async () => {
      await request(server()).get('/api/v1/subjects').set('Cookie', adminCookie).expect(403);
      await request(server())
        .post('/api/v1/subjects')
        .set('Cookie', adminCookie)
        .send({ code: 'PHY', name: 'Physics' })
        .expect(403);
    });

    it('lets a Super Admin through', async () => {
      await asSuper('get', '/subjects').expect(200);
    });
  });

  describe('create', () => {
    it('creates a subject and returns it in the standard envelope', async () => {
      const res = await asSuper('post', '/subjects')
        .send({ code: 'PHY', name: 'Physics' })
        .expect(201);

      const body = res.body as Envelope<SubjectBody>;
      expect(body.success).toBe(true);
      expect(body.data).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown as string,
        code: 'PHY',
        name: 'Physics',
        isActive: true,
      });
    });

    it('answers 409 for a duplicate code — not a 500', async () => {
      await createSubject('PHY', 'Physics');

      await asSuper('post', '/subjects').send({ code: 'PHY', name: 'Physics Again' }).expect(409);
    });

    it('treats a code differing only by case as a duplicate', async () => {
      await createSubject('PHY', 'Physics');

      await asSuper('post', '/subjects').send({ code: 'phy', name: 'Lowercase' }).expect(409);
    });

    it('rejects a bad payload with a 400', async () => {
      await asSuper('post', '/subjects').send({ code: '', name: 'Physics' }).expect(400);
      await asSuper('post', '/subjects').send({ code: 'PH Y', name: 'Physics' }).expect(400);
      await asSuper('post', '/subjects').send({ code: 'PHY' }).expect(400);
    });

    it('rejects an unknown field rather than accepting and ignoring it', async () => {
      await asSuper('post', '/subjects')
        .send({ code: 'PHY', name: 'Physics', isActive: false })
        .expect(400);
    });
  });

  describe('list', () => {
    it('orders by name, case-insensitively', async () => {
      await createSubject('ZOO', 'zoology');
      await createSubject('ALG', 'Algebra');
      await createSubject('PHY', 'Physics');

      const res = await asSuper('get', '/subjects').expect(200);

      expect((res.body as Envelope<SubjectBody[]>).data.map((s) => s.name)).toEqual([
        'Algebra',
        'Physics',
        'zoology',
      ]);
    });

    it('includes deactivated subjects by default', async () => {
      const phy = await createSubject('PHY', 'Physics');
      await asSuper('patch', `/subjects/${phy.id}/status`).send({ isActive: false }).expect(200);

      const res = await asSuper('get', '/subjects').expect(200);

      expect((res.body as Envelope<SubjectBody[]>).data).toHaveLength(1);
    });

    it('hides them behind ?activeOnly=true', async () => {
      const phy = await createSubject('PHY', 'Physics');
      await createSubject('BIO', 'Biology');
      await asSuper('patch', `/subjects/${phy.id}/status`).send({ isActive: false }).expect(200);

      const res = await asSuper('get', '/subjects?activeOnly=true').expect(200);

      expect((res.body as Envelope<SubjectBody[]>).data.map((s) => s.code)).toEqual(['BIO']);
    });

    it('rejects an activeOnly value that is neither true nor false', async () => {
      await asSuper('get', '/subjects?activeOnly=1').expect(400);
    });
  });

  it('has no single-subject read — the list already carries every field', async () => {
    const phy = await createSubject('PHY', 'Physics');

    await asSuper('get', `/subjects/${phy.id}`).expect(404);
  });

  describe('update', () => {
    it('renames a subject', async () => {
      const phy = await createSubject('PHY', 'Physics');

      const res = await asSuper('patch', `/subjects/${phy.id}`)
        .send({ name: 'Physics (Higher)' })
        .expect(200);

      const body = (res.body as Envelope<SubjectBody>).data;
      expect(body.name).toBe('Physics (Higher)');
      // The field that was not sent is untouched.
      expect(body.code).toBe('PHY');
    });

    it('answers 409 when the new code is taken', async () => {
      const phy = await createSubject('PHY', 'Physics');
      await createSubject('BIO', 'Biology');

      await asSuper('patch', `/subjects/${phy.id}`).send({ code: 'BIO' }).expect(409);
    });

    it('400s on an empty patch', async () => {
      const phy = await createSubject('PHY', 'Physics');

      await asSuper('patch', `/subjects/${phy.id}`).send({}).expect(400);
    });

    it('404s for an unknown id', async () => {
      await asSuper('patch', `/subjects/${UNKNOWN_ID}`).send({ name: 'X' }).expect(404);
    });
  });

  describe('status', () => {
    it('deactivates and reactivates', async () => {
      const phy = await createSubject('PHY', 'Physics');

      const off = await asSuper('patch', `/subjects/${phy.id}/status`)
        .send({ isActive: false })
        .expect(200);
      expect((off.body as Envelope<SubjectBody>).data.isActive).toBe(false);

      const on = await asSuper('patch', `/subjects/${phy.id}/status`)
        .send({ isActive: true })
        .expect(200);
      expect((on.body as Envelope<SubjectBody>).data.isActive).toBe(true);
    });

    it('is idempotent — sending the same state twice is not an error', async () => {
      const phy = await createSubject('PHY', 'Physics');

      await asSuper('patch', `/subjects/${phy.id}/status`).send({ isActive: false }).expect(200);
      await asSuper('patch', `/subjects/${phy.id}/status`).send({ isActive: false }).expect(200);
    });

    it('404s for an unknown id', async () => {
      await asSuper('patch', `/subjects/${UNKNOWN_ID}/status`)
        .send({ isActive: false })
        .expect(404);
    });
  });

  it('has no delete route — deactivation is the withdrawal path', async () => {
    const phy = await createSubject('PHY', 'Physics');

    await asSuper('delete', `/subjects/${phy.id}`).expect(404);
  });

  it('stamps the acting super admin on create', async () => {
    const phy = await createSubject('PHY', 'Physics');

    const rows: Array<{ created_by: string | null; updated_by: string | null }> =
      await dataSource.query('select created_by, updated_by from subjects where id = $1', [phy.id]);

    expect(rows[0]?.created_by).not.toBeNull();
    expect(rows[0]?.updated_by).toBe(rows[0]?.created_by);
  });
});
