import { type DataSource } from 'typeorm';

import { createDataSource } from '../src/persistence/typeorm/data-source';
import { InstituteViewGrants1759000000000 } from '../src/persistence/typeorm/migrations/1759000000000-institute-view-grants';
import { seedDatabase } from '../src/persistence/typeorm/seed/seed';
import { requireTestDatabaseUrl } from './test-database';

const TEST_URL = requireTestDatabaseUrl();

const SUPER = {
  email: 'superadmin@oses.pk',
  fullName: 'Super Admin',
  password: 'change-me-to-a-strong-password-min-12-chars',
};

/**
 * The Admin institute-grant correction, tested against the state it actually exists for.
 *
 * A fresh database is correct from the seed alone, so every other e2e spec would pass whether
 * this migration existed or not. What is untested anywhere else — and what will actually happen
 * on the deployed environment — is a database seeded *before* the split, still carrying
 * `institutes.manage` on Admin. The seed is insert-only by design and cannot take that away, so
 * this migration is the only thing that does. These tests manufacture that state and prove it.
 */
describe('InstituteViewGrants migration (integration)', () => {
  let dataSource: DataSource;

  const VIEW_ACTIONS = ['institute-categories.view', 'institutes.view'];

  const migration = new InstituteViewGrants1759000000000();

  async function runUp(): Promise<void> {
    const runner = dataSource.createQueryRunner();
    try {
      await migration.up(runner);
    } finally {
      await runner.release();
    }
  }

  async function runDown(): Promise<void> {
    const runner = dataSource.createQueryRunner();
    try {
      await migration.down(runner);
    } finally {
      await runner.release();
    }
  }

  async function actionsFor(roleCode: string): Promise<string[]> {
    const rows: { action: string }[] = await dataSource.query(
      `select p."action" from "role_grants" g ` +
        `join "roles" r on r."id" = g."role_id" ` +
        `join "permissions" p on p."id" = g."permission_id" ` +
        `where r."code" = $1 and p."action" like 'institute%' order by p."action"`,
      [roleCode],
    );
    return rows.map((r) => r.action);
  }

  async function catalogueHas(action: string): Promise<boolean> {
    const rows: unknown[] = await dataSource.query(
      `select 1 from "permissions" where "action" = $1`,
      [action],
    );
    return rows.length > 0;
  }

  /** A database as it stood before the split: no view actions at all, manage on Admin. */
  async function revertToPreSplitState(): Promise<void> {
    await dataSource.query(
      `delete from "role_grants" g using "permissions" p ` +
        `where g."permission_id" = p."id" and p."action" = any($1)`,
      [VIEW_ACTIONS],
    );
    await dataSource.query(`delete from "permissions" where "action" = any($1)`, [VIEW_ACTIONS]);
    await dataSource.query(
      `insert into "role_grants" ("role_id", "permission_id", "scope") ` +
        `select r."id", p."id", 'all' from "roles" r cross join "permissions" p ` +
        `where r."code" = 'admin' and p."action" = 'institutes.manage' ` +
        `on conflict ("role_id", "permission_id") do nothing`,
    );
  }

  beforeAll(async () => {
    dataSource = createDataSource(TEST_URL);
    await dataSource.initialize();
    await dataSource.runMigrations();
    await seedDatabase(dataSource, { superAdmin: SUPER });
  });

  afterAll(async () => {
    // Leave the database in the target state whichever test ran last — the seed that follows in
    // another spec is insert-only and would not put it right.
    await runUp();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await revertToPreSplitState();
  });

  it('takes institutes.manage off Admin on a database seeded before the split', async () => {
    expect(await actionsFor('admin')).toContain('institutes.manage');

    await runUp();

    const actions = await actionsFor('admin');
    expect(actions).not.toContain('institutes.manage');
    expect(actions).not.toContain('institute-categories.manage');
    expect(actions).toEqual(VIEW_ACTIONS);
  });

  it('plants the two new actions in a catalogue that predates them', async () => {
    expect(await catalogueHas('institutes.view')).toBe(false);
    expect(await catalogueHas('institute-categories.view')).toBe(false);

    await runUp();

    expect(await catalogueHas('institutes.view')).toBe(true);
    expect(await catalogueHas('institute-categories.view')).toBe(true);
  });

  it('leaves Super Admin holding both halves', async () => {
    await runUp();

    const actions = await actionsFor('super_admin');
    for (const action of [
      'institutes.view',
      'institutes.manage',
      'institute-categories.view',
      'institute-categories.manage',
    ]) {
      expect(actions).toContain(action);
    }
  });

  it('changes nothing on a database that is already correct', async () => {
    await runUp();
    const before = await actionsFor('admin');
    const superBefore = await actionsFor('super_admin');

    await runUp();

    expect(await actionsFor('admin')).toEqual(before);
    expect(await actionsFor('super_admin')).toEqual(superBefore);
  });

  /**
   * The one thing this migration must not do. A custom role given `institutes.manage` on purpose
   * is somebody's decision; matching on `roles.code = 'admin'` is what keeps it out of range, and
   * a broader `delete ... where action = 'institutes.manage'` would silently revoke it.
   */
  it('leaves a custom role holding institutes.manage alone', async () => {
    await dataSource.query(
      `insert into "roles" ("code", "name", "is_system") values ('regional_lead', 'Regional Lead', false)`,
    );
    await dataSource.query(
      `insert into "role_grants" ("role_id", "permission_id", "scope") ` +
        `select r."id", p."id", 'all' from "roles" r cross join "permissions" p ` +
        `where r."code" = 'regional_lead' and p."action" = 'institutes.manage'`,
    );

    try {
      await runUp();
      expect(await actionsFor('regional_lead')).toContain('institutes.manage');
    } finally {
      await dataSource.query(`delete from "roles" where "code" = 'regional_lead'`);
    }
  });

  describe('down', () => {
    it('puts Admin back the way it was', async () => {
      await runUp();

      await runDown();

      const actions = await actionsFor('admin');
      expect(actions).toContain('institutes.manage');
      expect(actions).not.toContain('institutes.view');
      expect(actions).not.toContain('institute-categories.view');
      expect(await catalogueHas('institutes.view')).toBe(false);
    });

    it('keeps the permission row when a custom role still holds it', async () => {
      await runUp();
      await dataSource.query(
        `insert into "roles" ("code", "name", "is_system") values ('regional_lead', 'Regional Lead', false)`,
      );
      await dataSource.query(
        `insert into "role_grants" ("role_id", "permission_id", "scope") ` +
          `select r."id", p."id", 'all' from "roles" r cross join "permissions" p ` +
          `where r."code" = 'regional_lead' and p."action" = 'institutes.view'`,
      );

      try {
        await runDown();

        // Dropping it would either fail on the foreign key or take the custom role's capability
        // with it. An unused catalogue row is the harmless outcome.
        expect(await catalogueHas('institutes.view')).toBe(true);
        expect(await actionsFor('regional_lead')).toContain('institutes.view');
      } finally {
        await dataSource.query(`delete from "roles" where "code" = 'regional_lead'`);
      }
    });
  });
});
