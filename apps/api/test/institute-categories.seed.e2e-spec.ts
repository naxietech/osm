import { type DataSource } from 'typeorm';

import { createDataSource } from '../src/persistence/typeorm/data-source';
import {
  InstituteCategoryEntity,
  InstituteCategoryQuestionEntity,
} from '../src/persistence/typeorm/entities';
import { seedInstituteCategories } from '../src/persistence/typeorm/seed/institute-categories.seed';

const TEST_URL = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
const describeDb = TEST_URL ? describe : describe.skip;

const STANDARD_CODES = ['ACD', 'BRD', 'COL', 'PECTA', 'SCH', 'UNI'];

describeDb('Institute category seed (integration)', () => {
  let dataSource: DataSource;

  const categories = () => dataSource.getRepository(InstituteCategoryEntity);
  const questions = () => dataSource.getRepository(InstituteCategoryQuestionEntity);

  beforeAll(async () => {
    dataSource = createDataSource(TEST_URL as string);
    await dataSource.initialize();
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query(
      'truncate table institute_category_questions, institute_categories restart identity cascade',
    );
  });

  it('plants the six standard categories on an empty database', async () => {
    const summary = await seedInstituteCategories(dataSource);

    expect(summary).toEqual({ categoriesCreated: 6, categoriesSkipped: 0, questionsCreated: 2 });

    const rows = await categories().find();
    expect(rows.map((c) => c.code).sort()).toEqual(STANDARD_CODES);
    expect(rows.every((c) => c.isActive)).toBe(true);
    expect(rows.every((c) => c.version === 1)).toBe(true);
  });

  it('gives School its two questions, ordered, each with a generated uuid', async () => {
    await seedInstituteCategories(dataSource);

    const school = await categories().findOneByOrFail({ code: 'SCH' });
    const rows = await questions().find({
      where: { categoryId: school.id },
      order: { sortOrder: 'ASC' },
    });

    expect(rows.map((q) => q.text)).toEqual([
      'Are you an ed-tech institute?',
      'Are you a Nawaz Sharif School of Eminence?',
    ]);
    expect(rows.map((q) => q.sortOrder)).toEqual([1, 2]);
    expect(rows[0]?.required).toBe(true);
    expect(rows[1]?.required).toBe(false);
    expect(rows.every((q) => /^[0-9a-f-]{36}$/.test(q.id))).toBe(true);
    expect(rows.every((q) => q.isActive)).toBe(true);
  });

  it('is safe to run repeatedly — no duplicates, no extra questions', async () => {
    await seedInstituteCategories(dataSource);
    const second = await seedInstituteCategories(dataSource);

    expect(second).toEqual({ categoriesCreated: 0, categoriesSkipped: 6, questionsCreated: 0 });
    expect(await categories().count()).toBe(6);
    expect(await questions().count()).toBe(2);
  });

  it("never overwrites an admin's edits", async () => {
    await seedInstituteCategories(dataSource);
    const school = await categories().findOneByOrFail({ code: 'SCH' });

    await categories().update(
      { id: school.id },
      { name: 'Government School', description: null, isActive: false },
    );
    await questions().delete({ categoryId: school.id });

    await seedInstituteCategories(dataSource);

    const after = await categories().findOneByOrFail({ code: 'SCH' });
    expect(after.name).toBe('Government School');
    expect(after.description).toBeNull();
    expect(after.isActive).toBe(false);
    // The questions the admin removed stay removed — the seed does not put them back.
    expect(await questions().countBy({ categoryId: after.id })).toBe(0);
  });

  it('re-creates the standard row when an admin changes a standard code', async () => {
    // `code` is admin-editable and is also the seed's idempotency key, so renaming a standard
    // category's code frees that code up. Documented here because it is the one case where
    // re-seeding adds something rather than doing nothing.
    await seedInstituteCategories(dataSource);
    const school = await categories().findOneByOrFail({ code: 'SCH' });
    await categories().update({ id: school.id }, { code: 'SCHOOL' });

    const summary = await seedInstituteCategories(dataSource);

    expect(summary.categoriesCreated).toBe(1);
    expect(await categories().count()).toBe(7);
    // The admin's renamed row is untouched...
    await expect(categories().findOneByOrFail({ code: 'SCHOOL' })).resolves.toBeDefined();
    // ...and a fresh standard School now sits alongside it.
    await expect(categories().findOneByOrFail({ code: 'SCH' })).resolves.toBeDefined();
  });

  it('re-creates a standard category that was deleted outright', async () => {
    await seedInstituteCategories(dataSource);
    await categories().delete({ code: 'PECTA' });
    expect(await categories().count()).toBe(5);

    const summary = await seedInstituteCategories(dataSource);

    expect(summary.categoriesCreated).toBe(1);
    expect(await categories().count()).toBe(6);
    await expect(categories().findOneByOrFail({ code: 'PECTA' })).resolves.toBeDefined();
  });

  it('treats a code that differs only by case as already present', async () => {
    await categories().save(categories().create({ code: 'sch', name: 'Lowercase school' }));

    const summary = await seedInstituteCategories(dataSource);

    expect(summary.categoriesCreated).toBe(5);
    expect(summary.categoriesSkipped).toBe(1);
    // The pre-existing row is untouched, and no second School was created.
    expect(await categories().findOneByOrFail({ code: 'SCH' })).toMatchObject({
      name: 'Lowercase school',
    });
  });

  it('does not duplicate when two seeds run concurrently', async () => {
    await Promise.all([
      seedInstituteCategories(dataSource),
      seedInstituteCategories(dataSource),
    ]).catch(() => {
      // A serialisation failure is an acceptable outcome for a race; the invariant below is what
      // must hold either way.
    });

    expect(await categories().count()).toBe(6);
    expect(await questions().count()).toBe(2);
  });
});
