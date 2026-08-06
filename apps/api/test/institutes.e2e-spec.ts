import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { InstitutionType, Province } from '@oses/types';

import { configureApp } from '../src/app-setup';
import { AppModule } from '../src/app.module';
import { createDataSource } from '../src/persistence/typeorm/data-source';
import {
  InstituteCategoryEntity,
  InstituteCategoryQuestionEntity,
  InstituteEntity,
  UserEntity,
} from '../src/persistence/typeorm/entities';
import { seedDatabase } from '../src/persistence/typeorm/seed/seed';
import { SYSTEM_ROLE_IDS } from '../src/rbac/system-roles';
import { hashPassword } from '../src/shared/crypto';
import { requireTestDatabaseUrl } from './test-database';

const TEST_URL = requireTestDatabaseUrl();
process.env['JWT_SECRET'] ??= 'test-only-secret-minimum-32-characters-long';
process.env['DATABASE_URL'] = TEST_URL;

const SUPER = {
  email: 'superadmin@oses.pk',
  password: 'test-password-strong-123',
  fullName: 'System Administrator',
};
const EVALUATOR = { email: 'checker-ira@oses.pk', password: 'checker-strong-pass-123' };

interface Envelope<T> {
  success: boolean;
  data: T;
}

/**
 * `POST /public/institutes` is rate limited to 5 per minute, and the throttler is a global guard
 * with a 60s window — so requests accumulate across the whole file. Tests that need an institute
 * without exercising that route create it through the repository instead. Keep the count here at
 * or below four.
 */
const PUBLIC_REGISTRATIONS_BUDGET = 4;

describe('Institutes (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let categoryId: string;
  let questionId: string;
  let superCookie: string;
  let evaluatorCookie: string;
  let publicRegistrations = 0;

  const server = () => app.getHttpServer();

  async function cookieFor(creds: { email: string; password: string }): Promise<string> {
    const res = await request(server()).post('/api/v1/auth/login').send(creds).expect(200);
    const raw = (res.headers['set-cookie'] ?? []) as unknown as string[];
    return raw.map((c) => c.split(';')[0]).join('; ');
  }

  const asSuper = (method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    request(server())[method](url).set('Cookie', superCookie);

  function registrationBody(over: Record<string, unknown> = {}) {
    return {
      instituteCode: 'S01',
      instituteName: 'Government High School',
      branch: 'Model Town Campus',
      categoryId,
      institutionType: InstitutionType.GOVERNMENT,
      address: '1 Mall Road',
      city: 'Lahore',
      province: Province.PUNJAB,
      postalCode: '54000',
      contactPersonName: 'Ayesha Khan',
      contactPersonDesignation: 'Principal',
      contactEmail: 'principal-ira@example.pk',
      contactPhone: '+92-42-1234567',
      answers: [{ questionId, values: ['Yes'] }],
      password: 'applicant-strong-pass',
      ...over,
    };
  }

  /** Spends one of the rate-limit budget and fails loudly rather than mysteriously if overdrawn. */
  function registerPublicly(over: Record<string, unknown> = {}) {
    publicRegistrations += 1;
    if (publicRegistrations > PUBLIC_REGISTRATIONS_BUDGET) {
      throw new Error('Public registration budget exceeded — seed through the repository instead');
    }
    return request(server()).post('/api/v1/public/institutes').send(registrationBody(over));
  }

  /** An institute created straight in the database, so it costs nothing against the rate limit. */
  async function seedInstitute(over: Partial<InstituteEntity> = {}): Promise<InstituteEntity> {
    return dataSource.getRepository(InstituteEntity).save({
      instituteCode: 'SEED1',
      instituteName: 'Seeded School',
      branch: null,
      categoryId,
      institutionType: InstitutionType.GOVERNMENT,
      address: '2 Canal Road',
      city: 'Lahore',
      province: Province.PUNJAB,
      postalCode: null,
      contactPersonName: 'Seed Contact',
      contactPersonDesignation: 'Principal',
      contactEmail: 'seed-ira@example.pk',
      contactPhone: '+92-42-7654321',
      status: 'pending',
      registrationSource: 'public',
      ...over,
    } as Partial<InstituteEntity>);
  }

  beforeAll(async () => {
    dataSource = createDataSource(process.env['DATABASE_URL'] as string);
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.query(
      'truncate table institute_category_questions, institute_categories, users, sessions, auth_audit_log, role_grants, roles, permissions restart identity cascade',
    );
    await seedDatabase(dataSource, { superAdmin: SUPER });

    await dataSource.getRepository(UserEntity).insert({
      email: EVALUATOR.email,
      passwordHash: await hashPassword(EVALUATOR.password),
      roleId: SYSTEM_ROLE_IDS.checker,
      fullName: 'Evaluator One',
      status: 'active',
    });

    const category = await dataSource
      .getRepository(InstituteCategoryEntity)
      .save({ code: 'SCH', name: 'School', description: null });
    categoryId = category.id;
    const question = await dataSource.getRepository(InstituteCategoryQuestionEntity).save({
      categoryId,
      text: 'Are you an ed-tech institute?',
      type: 'radio',
      required: true,
      options: ['Yes', 'No'],
      sortOrder: 1,
    });
    questionId = question.id;

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    superCookie = await cookieFor(SUPER);
    evaluatorCookie = await cookieFor(EVALUATOR);
  });

  afterAll(async () => {
    await app.close();
    await dataSource.destroy();
  });

  describe('the whole journey', () => {
    let instituteId: string;
    let receipt: Record<string, unknown>;

    it('accepts a public registration and answers with four fields, no more', async () => {
      const res = await registerPublicly().expect(201);
      receipt = (res.body as Envelope<Record<string, unknown>>).data;
      instituteId = receipt['id'] as string;

      // The public allow-list. Widening it must take a deliberate edit, so this asserts the exact
      // set rather than the absence of a few fields somebody thought of.
      expect(Object.keys(receipt).sort()).toEqual([
        'id',
        'instituteCode',
        'instituteName',
        'status',
      ]);
      expect(receipt['status']).toBe('pending');
    });

    it('leaks nothing about the application through the public response', () => {
      const serialised = JSON.stringify(receipt);
      for (const secret of ['applicant-strong-pass', 'argon2', 'principal-ira', 'Ayesha']) {
        expect(serialised).not.toContain(secret);
      }
    });

    it('shows up in the approval queue', async () => {
      const res = await asSuper('get', '/api/v1/institutes?status=pending').expect(200);
      const body = (res.body as Envelope<{ items: Array<{ id: string }>; total: number }>).data;
      expect(body.items.map((i) => i.id)).toContain(instituteId);
      expect(body.total).toBeGreaterThan(0);
    });

    it('carries the answers and no numeric code while pending', async () => {
      const res = await asSuper('get', `/api/v1/institutes/${instituteId}`).expect(200);
      const body = (res.body as Envelope<Record<string, unknown>>).data;
      expect(body['numericCode']).toBeNull();
      expect(body['answers']).toEqual([{ questionId, values: ['Yes'] }]);
      expect(body['possibleDuplicates']).toEqual([]);
    });

    it('approves, draws a numeric code and reports the account', async () => {
      const res = await asSuper('post', `/api/v1/institutes/${instituteId}/approve`)
        .send({ createLogin: true })
        .expect(200);
      const body = (res.body as Envelope<{ institute: Record<string, unknown>; userId: string }>)
        .data;

      expect(body.institute['status']).toBe('approved');
      expect(body.institute['numericCode']).toEqual(expect.any(Number));
      expect(body.userId).toEqual(expect.any(String));
    });

    it('lets the institute sign in with the password it chose at registration', async () => {
      // The point of the whole flow: no email service, no temporary password read down a phone.
      await request(server())
        .post('/api/v1/auth/login')
        .send({ email: 'principal-ira@example.pk', password: 'applicant-strong-pass' })
        .expect(200);
    });

    it('409s on a second approval rather than minting a second account', async () => {
      await asSuper('post', `/api/v1/institutes/${instituteId}/approve`)
        .send({ createLogin: true })
        .expect(409);

      const users = await dataSource.getRepository(UserEntity).count({ where: { instituteId } });
      expect(users).toBe(1);
    });

    it('stops that login working once the institute is deactivated', async () => {
      await asSuper('patch', `/api/v1/institutes/${instituteId}/status`)
        .send({ status: 'deactivated' })
        .expect(200);

      await request(server())
        .post('/api/v1/auth/login')
        .send({ email: 'principal-ira@example.pk', password: 'applicant-strong-pass' })
        .expect(401);
    });
  });

  describe('permissions', () => {
    it('refuses an evaluator on every admin route', async () => {
      const asEvaluator = (method: 'get' | 'post', url: string) =>
        request(server())[method](url).set('Cookie', evaluatorCookie);

      await asEvaluator('get', '/api/v1/institutes').expect(403);
      await asEvaluator('post', '/api/v1/institutes').send(registrationBody()).expect(403);
    });

    it('refuses an anonymous caller on the admin routes', async () => {
      await request(server()).get('/api/v1/institutes').expect(401);
    });

    it('serves the public routes with no credentials at all', async () => {
      await request(server())
        .post('/api/v1/public/institutes/check-availability')
        .send({ instituteCode: 'NOBODY-HAS-THIS' })
        .expect(200);
    });
  });

  describe('the availability check', () => {
    it('reports a registered code as taken and answers null for what it was not asked', async () => {
      await seedInstitute({ instituteCode: 'TAKEN1' });

      const res = await request(server())
        .post('/api/v1/public/institutes/check-availability')
        .send({ instituteCode: 'TAKEN1' })
        .expect(200);

      expect((res.body as Envelope<unknown>).data).toEqual({
        codeAvailable: false,
        emailAvailable: null,
      });
    });

    it('refuses an empty body rather than making a pointless round trip', async () => {
      await request(server())
        .post('/api/v1/public/institutes/check-availability')
        .send({})
        .expect(400);
    });
  });

  describe('errors that must not be 500s', () => {
    it('answers 409 — not 500 — for a duplicate institute code', async () => {
      await seedInstitute({ instituteCode: 'DUP1' });
      await registerPublicly({ instituteCode: 'DUP1', contactEmail: 'dup@example.pk' }).expect(409);
    });

    it('answers 400 for a category that asks for a file upload', async () => {
      const fileCategory = await dataSource
        .getRepository(InstituteCategoryEntity)
        .save({ code: 'FILE', name: 'Needs a file', description: null });
      await dataSource.getRepository(InstituteCategoryQuestionEntity).save({
        categoryId: fileCategory.id,
        text: 'Upload your charter',
        type: 'file',
        required: true,
        options: [],
        sortOrder: 1,
      });

      const res = await registerPublicly({
        instituteCode: 'FILE1',
        categoryId: fileCategory.id,
        contactEmail: 'file@example.pk',
        answers: [],
      }).expect(400);
      expect(JSON.stringify(res.body)).toMatch(/file upload/i);
    });

    it('answers 400 for a malformed institute id, never a 500', async () => {
      await asSuper('get', '/api/v1/institutes/not-a-uuid').expect(400);
    });

    it('answers 404 for an institute that does not exist', async () => {
      await asSuper('get', '/api/v1/institutes/11111111-1111-4111-8111-111111111111').expect(404);
    });
  });

  describe('the locked fields', () => {
    it('refuses to change the institute code, category or answers', async () => {
      const institute = await seedInstitute({ instituteCode: 'LOCK1' });

      for (const patch of [
        { instituteCode: 'LOCK2' },
        { categoryId },
        { answers: [] },
        { status: 'approved' },
      ]) {
        await asSuper('patch', `/api/v1/institutes/${institute.id}`).send(patch).expect(400);
      }
    });

    it('accepts the fields that stay editable, including the contact email', async () => {
      const institute = await seedInstitute({ instituteCode: 'EDIT1' });

      const res = await asSuper('patch', `/api/v1/institutes/${institute.id}`)
        .send({ city: 'Karachi', contactEmail: 'new-contact@example.pk' })
        .expect(200);
      const body = (res.body as Envelope<Record<string, unknown>>).data;
      expect(body['city']).toBe('Karachi');
      expect(body['contactEmail']).toBe('new-contact@example.pk');
    });
  });

  describe('rejection', () => {
    it('frees the code so the institute can apply again', async () => {
      const institute = await seedInstitute({ instituteCode: 'REJ1' });

      await asSuper('post', `/api/v1/institutes/${institute.id}/reject`)
        .send({ reason: 'Could not verify the government code' })
        .expect(200);

      const res = await request(server())
        .post('/api/v1/public/institutes/check-availability')
        .send({ instituteCode: 'REJ1' })
        .expect(200);
      expect((res.body as Envelope<{ codeAvailable: boolean }>).data.codeAvailable).toBe(true);
    });

    it('requires a reason — without one nobody can be told what to fix', async () => {
      const institute = await seedInstitute({ instituteCode: 'REJ2' });
      await asSuper('post', `/api/v1/institutes/${institute.id}/reject`).send({}).expect(400);
    });
  });

  describe('deleting', () => {
    it('allows it while nothing is attached', async () => {
      const institute = await seedInstitute({ instituteCode: 'DEL1' });
      await asSuper('delete', `/api/v1/institutes/${institute.id}`).expect(200);
      await asSuper('get', `/api/v1/institutes/${institute.id}`).expect(404);
    });

    it('refuses once an account hangs off it, and says what is attached', async () => {
      const institute = await seedInstitute({
        instituteCode: 'DEL2',
        status: 'approved',
        numericCode: 9001,
      });
      await dataSource.getRepository(UserEntity).insert({
        email: 'attached-ira@example.pk',
        passwordHash: await hashPassword('attached-strong-pass'),
        roleId: SYSTEM_ROLE_IDS.institute,
        instituteId: institute.id,
        fullName: 'Attached User',
        status: 'active',
      });

      const res = await asSuper('delete', `/api/v1/institutes/${institute.id}`).expect(400);
      expect(JSON.stringify(res.body)).toMatch(/1 user/);
    });
  });

  describe('the duplicate warning', () => {
    it('surfaces a same-name same-city institute without blocking either', async () => {
      await seedInstitute({ instituteCode: 'TWIN1', instituteName: 'Twin School', city: 'Multan' });
      const second = await seedInstitute({
        instituteCode: 'TWIN2',
        instituteName: 'Twin School',
        city: 'Multan',
      });

      const res = await asSuper('get', `/api/v1/institutes/${second.id}`).expect(200);
      const body = (res.body as Envelope<{ possibleDuplicates: unknown[] }>).data;
      expect(body.possibleDuplicates).toHaveLength(1);
    });
  });
});
