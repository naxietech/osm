import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { configureApp } from '../src/app-setup';
import { AppModule } from '../src/app.module';
import { createDataSource } from '../src/persistence/typeorm/data-source';
import { UserEntity } from '../src/persistence/typeorm/entities';
import { seedClasses } from '../src/persistence/typeorm/seed/classes.seed';
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
const EVALUATOR = { email: 'checker-classes@oses.pk', password: 'checker-strong-pass-123' };
const ADMIN = { email: 'admin-classes@oses.pk', password: 'admin-strong-pass-123' };

const describeDb = TEST_URL ? describe : describe.skip;

interface Envelope<T> {
  success: boolean;
  data: T;
}
interface SubgroupBody {
  id: string;
  name: string;
  isActive: boolean;
}
interface GroupBody extends SubgroupBody {
  subgroups: SubgroupBody[];
}
interface ClassBody {
  id: string;
  name: string;
  ordinal: number;
  description?: string;
  isActive: boolean;
  version: number;
  groups: GroupBody[];
}

describeDb('Classes (e2e)', () => {
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
      'truncate table class_groups, classes, users, sessions, auth_audit_log, role_grants, roles, permissions restart identity cascade',
    );
    await seedDatabase(dataSource, { superAdmin: SUPER });

    const users = dataSource.getRepository(UserEntity);
    await users.save([
      users.create({
        email: EVALUATOR.email,
        passwordHash: await hashPassword(EVALUATOR.password),
        roleId: 'role_checker',
        fullName: 'Evaluator One',
        status: 'active',
      }),
      users.create({
        email: ADMIN.email,
        passwordHash: await hashPassword(ADMIN.password),
        roleId: 'role_admin',
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
    await dataSource.query('truncate table class_groups, classes restart identity cascade');
  });

  const asSuper = (method: 'get' | 'post' | 'patch', url: string) =>
    request(server())[method](url).set('Cookie', superCookie);

  const CLASS_9 = {
    name: 'Class 9',
    ordinal: 9,
    description: 'Secondary — SSC Part I',
    groups: [
      { name: 'Science', subgroups: [{ name: 'Biology' }, { name: 'Computer Science' }] },
      { name: 'General', subgroups: [] },
    ],
  };

  async function createClass9(): Promise<ClassBody> {
    const res = await asSuper('post', '/api/v1/classes').send(CLASS_9).expect(201);
    return (res.body as Envelope<ClassBody>).data;
  }

  function groupNamed(cls: ClassBody, name: string): GroupBody {
    const found = cls.groups.find((g) => g.name === name);
    if (!found) throw new Error(`no group named ${name} in ${JSON.stringify(cls.groups)}`);
    return found;
  }

  describe('access control', () => {
    it('refuses an anonymous caller', async () => {
      await request(server()).get('/api/v1/classes').expect(401);
    });

    it('refuses an Evaluator — no levels.manage grant', async () => {
      await request(server()).get('/api/v1/classes').set('Cookie', evaluatorCookie).expect(403);
    });

    it('refuses the limited Admin role, which holds operational data only', async () => {
      await request(server()).get('/api/v1/classes').set('Cookie', adminCookie).expect(403);
    });

    it('allows Super Admin', async () => {
      await asSuper('get', '/api/v1/classes').expect(200);
    });
  });

  describe('create', () => {
    it('returns the class with its whole tree and a starting version', async () => {
      const created = await createClass9();

      expect(created).toMatchObject({ name: 'Class 9', ordinal: 9, isActive: true, version: 1 });
      expect(created.groups.map((g) => g.name)).toEqual(['Science', 'General']);
      expect(groupNamed(created, 'Science').subgroups.map((s) => s.name)).toEqual([
        'Biology',
        'Computer Science',
      ]);
    });

    it('answers 409 for a duplicate name, not 500', async () => {
      await createClass9();

      const res = await asSuper('post', '/api/v1/classes')
        .send({ name: 'Class 9', ordinal: 9 })
        .expect(409);

      expect((res.body as { message: string }).message).toContain('already exists');
    });

    it('treats names case-insensitively, because the column is citext', async () => {
      await createClass9();

      await asSuper('post', '/api/v1/classes').send({ name: 'CLASS 9', ordinal: 9 }).expect(409);
    });

    it('creates a class with no groups at all — Class 1–8 have none', async () => {
      const res = await asSuper('post', '/api/v1/classes')
        .send({ name: 'Class 3', ordinal: 3 })
        .expect(201);

      expect((res.body as Envelope<ClassBody>).data.groups).toEqual([]);
    });

    it('refuses an ordinal outside 1–99', async () => {
      await asSuper('post', '/api/v1/classes').send({ name: 'Class X', ordinal: 0 }).expect(400);
    });

    it('refuses a group id, since nothing exists yet for one to refer to', async () => {
      await asSuper('post', '/api/v1/classes')
        .send({
          name: 'Class 9',
          ordinal: 9,
          groups: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Science' }],
        })
        .expect(400);
    });
  });

  describe('list', () => {
    it('orders by progression, not alphabetically', async () => {
      await asSuper('post', '/api/v1/classes').send({ name: 'Class 10', ordinal: 10 }).expect(201);
      await asSuper('post', '/api/v1/classes').send({ name: 'Class 9', ordinal: 9 }).expect(201);

      const res = await asSuper('get', '/api/v1/classes').expect(200);

      // Sorted by name this would be the other way round, which is the whole reason `ordinal`
      // is a column.
      expect((res.body as Envelope<ClassBody[]>).data.map((c) => c.name)).toEqual([
        'Class 9',
        'Class 10',
      ]);
    });

    it('includes deactivated classes by default and omits them for pickers', async () => {
      const created = await createClass9();
      await asSuper('patch', `/api/v1/classes/${created.id}/status`)
        .send({ isActive: false })
        .expect(200);

      const all = await asSuper('get', '/api/v1/classes').expect(200);
      const active = await asSuper('get', '/api/v1/classes?activeOnly=true').expect(200);

      expect((all.body as Envelope<ClassBody[]>).data).toHaveLength(1);
      expect((active.body as Envelope<ClassBody[]>).data).toHaveLength(0);
    });

    it('carries the full tree, so the edit form needs no second request', async () => {
      await createClass9();

      const res = await asSuper('get', '/api/v1/classes').expect(200);
      const [cls] = (res.body as Envelope<ClassBody[]>).data;

      expect(cls?.groups).toHaveLength(2);
      expect(groupNamed(cls as ClassBody, 'Science').subgroups).toHaveLength(2);
    });
  });

  describe('the tree save', () => {
    it('keeps ids for nodes it is given back, so references survive an edit', async () => {
      const created = await createClass9();
      const science = groupNamed(created, 'Science');
      const biology = science.subgroups[0];

      const res = await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({
          version: created.version,
          groups: [
            {
              id: science.id,
              name: 'Science',
              subgroups: [{ id: biology?.id, name: 'Biology' }],
            },
          ],
        })
        .expect(200);

      const updated = (res.body as Envelope<ClassBody>).data;
      expect(groupNamed(updated, 'Science').id).toBe(science.id);
      expect(groupNamed(updated, 'Science').subgroups[0]?.id).toBe(biology?.id);
    });

    it('renames a group in place', async () => {
      const created = await createClass9();
      const science = groupNamed(created, 'Science');

      const res = await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({
          version: created.version,
          groups: [{ id: science.id, name: 'Sciences', subgroups: [] }],
        })
        .expect(200);

      const updated = (res.body as Envelope<ClassBody>).data;
      expect(groupNamed(updated, 'Sciences').id).toBe(science.id);
    });

    it('adds a subgroup to an existing group', async () => {
      const created = await createClass9();
      const science = groupNamed(created, 'Science');

      const res = await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({
          version: created.version,
          groups: [
            {
              id: science.id,
              name: 'Science',
              subgroups: [
                ...science.subgroups.map((s) => ({ id: s.id, name: s.name })),
                { name: 'Physics' },
              ],
            },
          ],
        })
        .expect(200);

      const updated = (res.body as Envelope<ClassBody>).data;
      expect(groupNamed(updated, 'Science').subgroups.map((s) => s.name)).toEqual([
        'Biology',
        'Computer Science',
        'Physics',
      ]);
    });

    it('deactivates a dropped group rather than deleting it', async () => {
      const created = await createClass9();
      const science = groupNamed(created, 'Science');
      const general = groupNamed(created, 'General');

      await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({
          version: created.version,
          groups: [{ id: science.id, name: 'Science', subgroups: [] }],
        })
        .expect(200);

      // Gone from the API…
      const res = await asSuper('get', `/api/v1/classes/${created.id}`).expect(200);
      expect((res.body as Envelope<ClassBody>).data.groups.map((g) => g.name)).toEqual(['Science']);

      // …but still a row, because student and exam records will point at this id.
      const rows = await dataSource.query('select is_active from class_groups where id = $1', [
        general.id,
      ]);
      expect(rows).toEqual([{ is_active: false }]);
    });

    it("takes a dropped group's subgroups down with it", async () => {
      const created = await createClass9();
      const general = groupNamed(created, 'General');

      await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({ version: created.version, groups: [{ id: general.id, name: 'General' }] })
        .expect(200);

      const rows = await dataSource.query(
        'select count(*)::int as live from class_groups where is_active = true',
      );
      expect(rows[0]?.live).toBe(1);
    });

    it('revives the original row when a deactivated name is added again', async () => {
      const created = await createClass9();
      const science = groupNamed(created, 'Science');
      const general = groupNamed(created, 'General');

      const dropped = await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({
          version: created.version,
          groups: [{ id: science.id, name: 'Science', subgroups: [] }],
        })
        .expect(200);

      const res = await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({
          version: (dropped.body as Envelope<ClassBody>).data.version,
          groups: [
            { id: science.id, name: 'Science', subgroups: [] },
            { name: 'General', subgroups: [] },
          ],
        })
        .expect(200);

      // The same id comes back. Inserting instead would be refused by the sibling unique
      // index, over a group the admin cannot see.
      expect(groupNamed((res.body as Envelope<ClassBody>).data, 'General').id).toBe(general.id);
    });

    it('leaves the tree alone when groups is omitted', async () => {
      const created = await createClass9();

      const res = await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({ version: created.version, name: 'Class Nine' })
        .expect(200);

      const updated = (res.body as Envelope<ClassBody>).data;
      expect(updated.name).toBe('Class Nine');
      expect(updated.groups).toHaveLength(2);
    });

    it('clears the tree when groups is an empty array', async () => {
      const created = await createClass9();

      const res = await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({ version: created.version, groups: [] })
        .expect(200);

      expect((res.body as Envelope<ClassBody>).data.groups).toEqual([]);
    });

    it('keeps the authored order across a save, and reorders when the payload does', async () => {
      const created = await createClass9();
      const science = groupNamed(created, 'Science');
      const general = groupNamed(created, 'General');

      const res = await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({
          version: created.version,
          groups: [
            { id: general.id, name: 'General', subgroups: [] },
            { id: science.id, name: 'Science', subgroups: [] },
          ],
        })
        .expect(200);

      // Order is a stored column, not an accident of insert time — both rows are written in
      // one statement and share `created_at` to the microsecond.
      expect((res.body as Envelope<ClassBody>).data.groups.map((g) => g.name)).toEqual([
        'General',
        'Science',
      ]);

      const reread = await asSuper('get', `/api/v1/classes/${created.id}`).expect(200);
      expect((reread.body as Envelope<ClassBody>).data.groups.map((g) => g.name)).toEqual([
        'General',
        'Science',
      ]);
    });

    it('refuses a group id belonging to another class', async () => {
      const nine = await createClass9();
      const other = await asSuper('post', '/api/v1/classes')
        .send({ name: 'Class 10', ordinal: 10, groups: [{ name: 'Science' }] })
        .expect(201);
      const foreign = groupNamed((other.body as Envelope<ClassBody>).data, 'Science');

      await asSuper('patch', `/api/v1/classes/${nine.id}`)
        .send({ version: nine.version, groups: [{ id: foreign.id, name: 'Science' }] })
        .expect(400);
    });

    it('refuses a subgroup under a subgroup — the rule SQL cannot hold', async () => {
      const created = await createClass9();
      const science = groupNamed(created, 'Science');
      const biology = science.subgroups[0];

      // Biology sent as a top-level group would make its own subgroups a third level.
      await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({
          version: created.version,
          groups: [{ id: biology?.id, name: 'Biology', subgroups: [{ name: 'Genetics' }] }],
        })
        .expect(400);
    });

    it('refuses two groups sharing a name in one payload', async () => {
      const created = await createClass9();

      await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({
          version: created.version,
          groups: [{ name: 'Commerce' }, { name: 'commerce' }],
        })
        .expect(400);
    });
  });

  describe('optimistic locking', () => {
    it('refuses a save built on a version someone else has already replaced', async () => {
      const created = await createClass9();

      await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({ version: created.version, name: 'Class Nine' })
        .expect(200);

      // The second admin still holds version 1 and would have dropped both groups.
      const res = await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({ version: created.version, groups: [] })
        .expect(409);

      expect((res.body as { message: string }).message).toContain('Reload');
    });

    it('writes nothing at all when the version check fails', async () => {
      const created = await createClass9();
      await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({ version: created.version, name: 'Class Nine' })
        .expect(200);

      await asSuper('patch', `/api/v1/classes/${created.id}`)
        .send({ version: created.version, groups: [] })
        .expect(409);

      // The stale caller's empty tree must not have been applied even partially.
      const res = await asSuper('get', `/api/v1/classes/${created.id}`).expect(200);
      expect((res.body as Envelope<ClassBody>).data.groups).toHaveLength(2);
    });

    it('bumps the version on a status change too', async () => {
      const created = await createClass9();

      const res = await asSuper('patch', `/api/v1/classes/${created.id}/status`)
        .send({ isActive: false })
        .expect(200);

      expect((res.body as Envelope<ClassBody>).data.version).toBe(created.version + 1);
    });
  });

  describe('lookups', () => {
    it('404s for an id that does not exist', async () => {
      await asSuper('get', '/api/v1/classes/11111111-1111-4111-8111-111111111111').expect(404);
    });

    it('404s rather than 500s for an id that is not a uuid at all', async () => {
      await asSuper('get', '/api/v1/classes/not-a-uuid').expect(404);
    });
  });

  describe('what the database itself refuses', () => {
    it('will not let a subgroup belong to a different class than its group', async () => {
      const nine = await createClass9();
      const ten = await asSuper('post', '/api/v1/classes')
        .send({ name: 'Class 10', ordinal: 10 })
        .expect(201);
      const scienceInNine = groupNamed(nine, 'Science');
      const tenId = (ten.body as Envelope<ClassBody>).data.id;

      // The composite foreign key (parent_id, class_id) is what makes this impossible: the
      // parent row has to match on BOTH columns.
      await expect(
        dataSource.query(
          'insert into class_groups (class_id, parent_id, name) values ($1, $2, $3)',
          [tenId, scienceInNine.id, 'Stolen'],
        ),
      ).rejects.toThrow();
    });

    it('will not let two groups in one class share a name', async () => {
      const nine = await createClass9();

      await expect(
        dataSource.query(
          'insert into class_groups (class_id, parent_id, name) values ($1, null, $2)',
          [nine.id, 'science'],
        ),
      ).rejects.toThrow();
    });

    it('lets two different classes each have a group with the same name', async () => {
      await createClass9();
      const ten = await asSuper('post', '/api/v1/classes')
        .send({ name: 'Class 10', ordinal: 10, groups: [{ name: 'Science' }] })
        .expect(201);

      expect((ten.body as Envelope<ClassBody>).data.groups[0]?.name).toBe('Science');
    });

    it('refuses an ordinal outside the checked range even by direct insert', async () => {
      await expect(
        dataSource.query('insert into classes (name, ordinal) values ($1, $2)', ['Class 100', 100]),
      ).rejects.toThrow();
    });
  });

  describe('seed', () => {
    it('plants Class 9–12 with their groups, and a second run changes nothing', async () => {
      const first = await seedClasses(dataSource);
      const second = await seedClasses(dataSource);

      expect(first.classesCreated).toBe(4);
      expect(first.groupsCreated).toBeGreaterThan(0);
      expect(second).toMatchObject({ classesCreated: 0, classesSkipped: 4, groupsCreated: 0 });
    });

    it("never overwrites an admin's edit to a seeded class", async () => {
      await seedClasses(dataSource);
      const list = await asSuper('get', '/api/v1/classes').expect(200);
      const nine = (list.body as Envelope<ClassBody[]>).data.find((c) => c.name === 'Class 9');

      await asSuper('patch', `/api/v1/classes/${nine?.id}`)
        .send({ version: nine?.version, description: 'Edited by an admin' })
        .expect(200);
      await seedClasses(dataSource);

      const after = await asSuper('get', `/api/v1/classes/${nine?.id}`).expect(200);
      expect((after.body as Envelope<ClassBody>).data.description).toBe('Edited by an admin');
    });
  });
});
