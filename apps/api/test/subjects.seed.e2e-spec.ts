import { type DataSource } from 'typeorm';

import { createDataSource } from '../src/persistence/typeorm/data-source';
import { SubjectEntity } from '../src/persistence/typeorm/entities';
import { seedSubjects } from '../src/persistence/typeorm/seed/subjects.seed';

const TEST_URL = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
const describeDb = TEST_URL ? describe : describe.skip;

const STANDARD_CODES = ['BIO', 'CHEM', 'CS', 'ENG', 'ISL', 'MATH', 'PAK', 'PHY', 'URD'];

describeDb('Subject seed (integration)', () => {
  let dataSource: DataSource;

  const subjects = () => dataSource.getRepository(SubjectEntity);

  beforeAll(async () => {
    dataSource = createDataSource(TEST_URL as string);
    await dataSource.initialize();
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query('truncate table subjects restart identity cascade');
  });

  it('plants the nine standard subjects on an empty database', async () => {
    const summary = await seedSubjects(dataSource);

    expect(summary).toEqual({ created: 9, skipped: 0 });

    const rows = await subjects().find();
    expect(rows.map((s) => s.code).sort()).toEqual(STANDARD_CODES);
    expect(rows.every((s) => s.isActive)).toBe(true);
    // Planted before any admin exists to own them.
    expect(rows.every((s) => s.createdBy === null && s.updatedBy === null)).toBe(true);
    expect(rows.every((s) => /^[0-9a-f-]{36}$/.test(s.id))).toBe(true);
  });

  it('is safe to run repeatedly — no duplicates', async () => {
    await seedSubjects(dataSource);
    const second = await seedSubjects(dataSource);

    expect(second).toEqual({ created: 0, skipped: 9 });
    expect(await subjects().count()).toBe(9);
  });

  it("never overwrites an admin's edits", async () => {
    await seedSubjects(dataSource);
    const physics = await subjects().findOneByOrFail({ code: 'PHY' });
    await subjects().update({ id: physics.id }, { name: 'Physics (Higher)', isActive: false });

    await seedSubjects(dataSource);

    const after = await subjects().findOneByOrFail({ code: 'PHY' });
    expect(after.name).toBe('Physics (Higher)');
    expect(after.isActive).toBe(false);
    expect(await subjects().count()).toBe(9);
  });

  it('re-creates the standard row when an admin changes a standard code', async () => {
    // `code` is admin-editable and is also the seed's idempotency key, so renaming a standard
    // subject's code frees that code up. Documented here because it is the one case where
    // re-seeding adds something rather than doing nothing.
    await seedSubjects(dataSource);
    const physics = await subjects().findOneByOrFail({ code: 'PHY' });
    await subjects().update({ id: physics.id }, { code: 'PHYS' });

    const summary = await seedSubjects(dataSource);

    expect(summary.created).toBe(1);
    expect(await subjects().count()).toBe(10);
    await expect(subjects().findOneByOrFail({ code: 'PHYS' })).resolves.toBeDefined();
    await expect(subjects().findOneByOrFail({ code: 'PHY' })).resolves.toBeDefined();
  });

  it('treats a code that differs only by case as already present', async () => {
    await subjects().save(subjects().create({ code: 'phy', name: 'Lowercase physics' }));

    const summary = await seedSubjects(dataSource);

    expect(summary).toEqual({ created: 8, skipped: 1 });
    // The pre-existing row is untouched, and no second Physics was created.
    expect(await subjects().findOneByOrFail({ code: 'PHY' })).toMatchObject({
      name: 'Lowercase physics',
    });
    expect(await subjects().count()).toBe(9);
  });

  it('does not duplicate when two seeds run concurrently', async () => {
    await Promise.all([seedSubjects(dataSource), seedSubjects(dataSource)]).catch(() => {
      // A serialisation failure is an acceptable outcome for a race; the invariant below is what
      // must hold either way.
    });

    expect(await subjects().count()).toBe(9);
  });
});
