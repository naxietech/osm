import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { configureApp } from '../src/app-setup';
import { AppModule } from '../src/app.module';
import { VERSION_CONFLICT_ERROR } from '../src/modules/institute-categories/institute-categories.service';
import { createDataSource } from '../src/persistence/typeorm/data-source';
import { UserEntity } from '../src/persistence/typeorm/entities';
import { seedDatabase } from '../src/persistence/typeorm/seed/seed';
import { SYSTEM_ROLE_IDS } from '../src/rbac/system-roles';
import { hashPassword } from '../src/shared/crypto';
import { resetInstituteData } from './reset-db';
import { requireTestDatabaseUrl } from './test-database';

const TEST_URL = requireTestDatabaseUrl();
process.env['JWT_SECRET'] ??= 'test-only-secret-minimum-32-characters-long';
process.env['DATABASE_URL'] = TEST_URL;

const SUPER = {
  email: 'superadmin@oses.pk',
  password: 'test-password-strong-123',
  fullName: 'System Administrator',
};
const EVALUATOR = { email: 'checker-icm@oses.pk', password: 'checker-strong-pass-123' };
const ADMIN = { email: 'admin-icm@oses.pk', password: 'admin-strong-pass-123' };

interface Envelope<T> {
  success: boolean;
  data: T;
}
interface CategoryBody {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  version?: number;
  questions: Array<{
    id: string;
    text: string;
    type: string;
    required: boolean;
    options: string[];
  }>;
}

/** A syntactically valid uuid that matches nothing — the guard must refuse before the lookup. */
const FAKE_ID = '11111111-1111-4111-8111-111111111111';

describe('Institute categories (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const server = () => app.getHttpServer();

  async function cookieFor(creds: { email: string; password: string }): Promise<string> {
    const res = await request(server()).post('/api/v1/auth/login').send(creds).expect(200);
    const raw = (res.headers['set-cookie'] ?? []) as unknown as string[];
    return raw.map((c) => c.split(';')[0]).join('; ');
  }

  let superCookie: string;
  let evaluatorCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    dataSource = createDataSource(process.env['DATABASE_URL'] as string);
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.query(
      'truncate table institute_category_questions, institute_categories, users, sessions, auth_audit_log, role_grants, roles, permissions restart identity cascade',
    );
    await seedDatabase(dataSource, { superAdmin: SUPER });

    const users = dataSource.getRepository(UserEntity);
    await users.save([
      users.create({
        email: EVALUATOR.email,
        passwordHash: await hashPassword(EVALUATOR.password),
        roleId: SYSTEM_ROLE_IDS.checker,
        fullName: 'Evaluator One',
        status: 'active',
      }),
      users.create({
        email: ADMIN.email,
        passwordHash: await hashPassword(ADMIN.password),
        roleId: SYSTEM_ROLE_IDS.admin,
        fullName: 'Admin One',
        status: 'active',
      }),
    ]);

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    superCookie = await cookieFor(SUPER);
    evaluatorCookie = await cookieFor(EVALUATOR);
    adminCookie = await cookieFor(ADMIN);
  });

  afterAll(async () => {
    await app.close();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await resetInstituteData(dataSource);
  });

  const asSuper = (method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    request(server())[method](url).set('Cookie', superCookie);

  async function createSchool(): Promise<CategoryBody> {
    const res = await asSuper('post', '/api/v1/institute-categories')
      .send({
        code: 'SCH',
        name: 'School',
        description: 'Primary and secondary schools',
        questions: [
          {
            text: 'Are you an ed-tech institute?',
            type: 'radio',
            required: true,
            options: ['Yes', 'No'],
          },
          { text: 'Describe your institute', type: 'text' },
        ],
      })
      .expect(201);
    return (res.body as Envelope<CategoryBody>).data;
  }

  describe('who is allowed in', () => {
    it('rejects an anonymous caller with 401', () =>
      request(server()).get('/api/v1/institute-categories').expect(401));

    it('rejects an Evaluator with 403 — no reference-data grant', () =>
      request(server())
        .get('/api/v1/institute-categories')
        .set('Cookie', evaluatorCookie)
        .expect(403));

    it('lets an Admin read the taxonomy', () =>
      request(server()).get('/api/v1/institute-categories').set('Cookie', adminCookie).expect(200));

    it('refuses an Admin every route that changes a category', async () => {
      // Reading and editing reference data are two different capabilities: an Admin needs to see
      // which categories exist while working on institutes, but the taxonomy itself is a Super
      // Admin decision. Enforced by the grant, never by a role check in the controller.
      const as = (method: 'post' | 'patch' | 'delete', url: string) =>
        request(server())[method](url).set('Cookie', adminCookie);

      await as('post', '/api/v1/institute-categories').send({ code: 'X', name: 'X' }).expect(403);
      await as('patch', `/api/v1/institute-categories/${FAKE_ID}`)
        .send({ version: 1, name: 'X' })
        .expect(403);
      await as('patch', `/api/v1/institute-categories/${FAKE_ID}/status`)
        .send({ isActive: false })
        .expect(403);
      await as('delete', `/api/v1/institute-categories/${FAKE_ID}`).expect(403);
    });

    it('allows a Super Admin', () => asSuper('get', '/api/v1/institute-categories').expect(200));
  });

  describe('create', () => {
    it('creates the category with its questions, each with a generated uuid', async () => {
      const created = await createSchool();

      expect(created.code).toBe('SCH');
      expect(created.version).toBe(1);
      expect(created.questions).toHaveLength(2);
      expect(created.questions[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(created.questions[0]?.options).toEqual(['Yes', 'No']);
    });

    it('rejects a duplicate code with 409, ignoring letter case', async () => {
      await createSchool();
      await asSuper('post', '/api/v1/institute-categories')
        .send({ code: 'sch', name: 'Dup' })
        .expect(409);
    });

    it.each([
      [
        'a choice question with no options',
        { code: 'A', name: 'A', questions: [{ text: 'Q', type: 'radio' }] },
      ],
      [
        'a text question carrying options',
        { code: 'B', name: 'B', questions: [{ text: 'Q', type: 'text', options: ['x'] }] },
      ],
      [
        'duplicate options',
        {
          code: 'C',
          name: 'C',
          questions: [{ text: 'Q', type: 'radio', options: ['Yes', 'Yes'] }],
        },
      ],
      [
        'an unknown question type',
        { code: 'D', name: 'D', questions: [{ text: 'Q', type: 'dropdown' }] },
      ],
      ['a blank name', { code: 'E', name: '   ' }],
      ['a code with spaces', { code: 'A B', name: 'F' }],
      ['an unexpected field', { code: 'G', name: 'G', isActive: false }],
      [
        'an unexpected field on a question',
        { code: 'H', name: 'H', questions: [{ text: 'Q', type: 'text', isActive: false }] },
      ],
    ])('rejects %s with 400', (_label, body) =>
      asSuper('post', '/api/v1/institute-categories').send(body).expect(400),
    );

    it('rejects more than 50 questions with 400', () =>
      asSuper('post', '/api/v1/institute-categories')
        .send({
          code: 'BIG',
          name: 'Big',
          questions: Array.from({ length: 51 }, (_, i) => ({ text: `Q${i}`, type: 'text' })),
        })
        .expect(400));
  });

  describe('update', () => {
    it('keeps existing question ids while inserting, reordering and removing', async () => {
      const created = await createSchool();
      const keptId = created.questions[0]?.id as string;

      const res = await asSuper('patch', `/api/v1/institute-categories/${created.id}`)
        .send({
          version: created.version,
          name: 'Government School',
          questions: [
            { text: 'Brand new, first in the list', type: 'text' },
            {
              id: keptId,
              text: 'Are you an ed-tech institute?',
              type: 'radio',
              required: true,
              options: ['Yes', 'No'],
            },
          ],
        })
        .expect(200);

      const updated = (res.body as Envelope<CategoryBody>).data;
      expect(updated.name).toBe('Government School');
      expect(updated.version).toBe(2);
      // Inserting at the top must not renumber the surviving question's identity.
      expect(updated.questions.map((q) => q.id)).toEqual([expect.any(String), keptId]);
    });

    it('answers 409 when someone else saved first', async () => {
      const created = await createSchool();
      await asSuper('patch', `/api/v1/institute-categories/${created.id}`)
        .send({ version: created.version, name: 'First writer wins' })
        .expect(200);

      await asSuper('patch', `/api/v1/institute-categories/${created.id}`)
        .send({ version: created.version, name: 'Second writer loses' })
        .expect(409);
    });

    /**
     * Three different failures answer 409 on this route, and only this one is fixed by reloading.
     * The web app branches on the `error` code to decide whether to say so, and the two sides
     * agree on a bare string — assert it here, or a rename ships a screen giving advice that
     * cannot work.
     */
    it('codes the optimistic-lock 409 apart from the conflicts reloading cannot fix', async () => {
      const created = await createSchool();
      await asSuper('patch', `/api/v1/institute-categories/${created.id}`)
        .send({ version: created.version, name: 'First writer wins' })
        .expect(200);

      const lost = await asSuper('patch', `/api/v1/institute-categories/${created.id}`)
        .send({ version: created.version, name: 'Second writer loses' })
        .expect(409);
      expect(lost.body.error).toBe(VERSION_CONFLICT_ERROR);
      expect(VERSION_CONFLICT_ERROR).toBe('CategoryVersionConflict');

      // A taken code is the caller's own submission being refused — it must NOT carry the code,
      // or the screen would tell them to reload for something reloading does not change.
      const taken = await asSuper('post', '/api/v1/institute-categories')
        .send({ code: created.code, name: 'Duplicate' })
        .expect(409);
      expect(taken.body.error).not.toBe(VERSION_CONFLICT_ERROR);
    });

    it('answers 400 for a question id from another category', async () => {
      const school = await createSchool();
      const other = await asSuper('post', '/api/v1/institute-categories')
        .send({
          code: 'COL',
          name: 'College',
          questions: [{ text: 'College only', type: 'radio', options: ['Yes'] }],
        })
        .expect(201);
      const foreignId = (other.body as Envelope<CategoryBody>).data.questions[0]?.id;

      await asSuper('patch', `/api/v1/institute-categories/${school.id}`)
        .send({
          version: school.version,
          questions: [{ id: foreignId, text: 'Stolen', type: 'radio', options: ['Yes'] }],
        })
        .expect(400);
    });

    it('distinguishes clearing the description from leaving it alone', async () => {
      const created = await createSchool();
      expect(created.description).toBe('Primary and secondary schools');

      // Omitted → untouched.
      const untouched = await asSuper('patch', `/api/v1/institute-categories/${created.id}`)
        .send({ version: created.version, name: 'Still described' })
        .expect(200);
      expect((untouched.body as Envelope<CategoryBody>).data.description).toBe(
        'Primary and secondary schools',
      );

      // Explicit null → cleared.
      const cleared = await asSuper('patch', `/api/v1/institute-categories/${created.id}`)
        .send({
          version: (untouched.body as Envelope<CategoryBody>).data.version,
          description: null,
        })
        .expect(200);
      expect((cleared.body as Envelope<CategoryBody>).data.description).toBeUndefined();
    });

    it('answers 404 for a category that does not exist', () =>
      asSuper('patch', '/api/v1/institute-categories/00000000-0000-4000-8000-000000000000')
        .send({ version: 1, name: 'nope' })
        .expect(404));

    it('answers 400 for an id that is not a uuid', () =>
      asSuper('patch', '/api/v1/institute-categories/not-a-uuid')
        .send({ version: 1, name: 'nope' })
        .expect(400));
  });

  describe('status and delete', () => {
    it('deactivates and reactivates', async () => {
      const created = await createSchool();

      const off = await asSuper('patch', `/api/v1/institute-categories/${created.id}/status`)
        .send({ isActive: false })
        .expect(200);
      expect((off.body as Envelope<CategoryBody>).data.isActive).toBe(false);

      const on = await asSuper('patch', `/api/v1/institute-categories/${created.id}/status`)
        .send({ isActive: true })
        .expect(200);
      expect((on.body as Envelope<CategoryBody>).data.isActive).toBe(true);
    });

    it('deletes an unused category with 204', async () => {
      const created = await createSchool();
      await asSuper('delete', `/api/v1/institute-categories/${created.id}`).expect(204);
      await asSuper('get', `/api/v1/institute-categories/${created.id}`).expect(404);
    });

    it('answers 404 when deleting something that is already gone', () =>
      asSuper('delete', '/api/v1/institute-categories/00000000-0000-4000-8000-000000000000').expect(
        404,
      ));
  });

  describe('the public endpoint', () => {
    const publicUrl = '/api/v1/public/institute-categories';

    it('serves anonymous callers and marks the response cacheable', async () => {
      await createSchool();

      const res = await request(server()).get(publicUrl).expect(200);
      expect(res.headers['cache-control']).toContain('max-age=60');
      expect((res.body as Envelope<CategoryBody[]>).data).toHaveLength(1);
    });

    it('hides deactivated categories', async () => {
      const created = await createSchool();
      await asSuper('patch', `/api/v1/institute-categories/${created.id}/status`)
        .send({ isActive: false })
        .expect(200);

      const res = await request(server()).get(publicUrl).expect(200);
      expect((res.body as Envelope<CategoryBody[]>).data).toEqual([]);
      // …while the admin view still sees it.
      const admin = await asSuper('get', '/api/v1/institute-categories').expect(200);
      expect((admin.body as Envelope<CategoryBody[]>).data).toHaveLength(1);
    });

    it('leaks no internal field to an anonymous caller', async () => {
      await createSchool();

      const res = await request(server()).get(publicUrl).expect(200);
      const [category] = (res.body as Envelope<CategoryBody[]>).data;

      expect(Object.keys(category ?? {}).sort()).toEqual([
        'code',
        'description',
        'id',
        'name',
        'questions',
      ]);
      expect(Object.keys(category?.questions[0] ?? {}).sort()).toEqual([
        'id',
        'options',
        'required',
        'text',
        'type',
      ]);
    });

    it('offers no way to fetch a single category by id', async () => {
      const created = await createSchool();
      await request(server()).get(`${publicUrl}/${created.id}`).expect(404);
    });
  });
});
