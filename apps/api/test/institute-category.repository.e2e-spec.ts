import { DataSource, type Logger as TypeOrmLogger } from 'typeorm';

import {
  type ApplyUpdateOutcome,
  CategoryCodeAlreadyExistsError,
  type InstituteCategoryRecord,
  type QuestionMutationPlan,
} from '../src/modules/institute-categories/ports';
import { buildDataSourceOptions, createDataSource } from '../src/persistence/typeorm/data-source';
import {
  InstituteCategoryEntity,
  InstituteCategoryQuestionEntity,
} from '../src/persistence/typeorm/entities';
import { TypeOrmInstituteCategoryRepository } from '../src/persistence/typeorm/repositories/institute-category.repository';

// Integration test — needs a reachable Postgres. Point DATABASE_URL_TEST (or DATABASE_URL)
// at the oses_test database. Skips cleanly when neither is set.
const TEST_URL = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
const describeDb = TEST_URL ? describe : describe.skip;

const EMPTY_PLAN: QuestionMutationPlan = { insert: [], update: [], deactivate: [], remove: [] };

/** Unwrap a successful update, failing loudly with the actual outcome when it is not one. */
function expectUpdated(result: ApplyUpdateOutcome): InstituteCategoryRecord {
  if (result.outcome !== 'updated') {
    throw new Error(`expected outcome "updated" but got "${result.outcome}"`);
  }
  return result.category;
}

/** Counts SELECTs so the "one query, never one-per-category" claim is proven, not asserted. */
class SelectCountingLogger implements TypeOrmLogger {
  selects = 0;
  logQuery(query: string): void {
    if (/^\s*select/i.test(query)) this.selects += 1;
  }
  logQueryError(): void {}
  logQuerySlow(): void {}
  logSchemaBuild(): void {}
  logMigration(): void {}
  log(): void {}
}

describeDb('TypeOrmInstituteCategoryRepository (integration)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmInstituteCategoryRepository;

  beforeAll(async () => {
    dataSource = createDataSource(TEST_URL as string);
    await dataSource.initialize();
    await dataSource.runMigrations();
    repo = new TypeOrmInstituteCategoryRepository(
      dataSource.getRepository(InstituteCategoryEntity),
      dataSource,
    );
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query(
      'truncate table institute_category_questions, institute_categories restart identity cascade',
    );
  });

  async function seedSchool() {
    return repo.create({
      code: 'SCH',
      name: 'School',
      description: 'Primary, middle and secondary schools',
      actorId: null,
      questions: [
        {
          text: 'Are you an ed-tech institute?',
          type: 'radio',
          required: true,
          options: ['Yes', 'No'],
          sortOrder: 1,
        },
        {
          text: 'Are you a Nawaz Sharif School of Eminence?',
          type: 'radio',
          required: false,
          options: ['Yes', 'No'],
          sortOrder: 2,
        },
      ],
    });
  }

  describe('create', () => {
    it('stores the category with its questions, in order, at version 1', async () => {
      const created = await seedSchool();

      expect(created.code).toBe('SCH');
      expect(created.version).toBe(1);
      expect(created.isActive).toBe(true);
      expect(created.questions.map((q) => q.sortOrder)).toEqual([1, 2]);
      expect(created.questions[0]?.text).toBe('Are you an ed-tech institute?');
      expect(created.questions[0]?.options).toEqual(['Yes', 'No']);
      expect(created.questions[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('rejects a duplicate code regardless of letter case', async () => {
      await seedSchool();

      await expect(
        repo.create({ code: 'sch', name: 'Dup', description: null, questions: [], actorId: null }),
      ).rejects.toBeInstanceOf(CategoryCodeAlreadyExistsError);
    });

    it('rolls the category back when a question is invalid', async () => {
      await expect(
        repo.create({
          code: 'BAD',
          name: 'Bad',
          description: null,
          actorId: null,
          // A radio question with no options violates the DB check constraint.
          questions: [
            { text: 'No options', type: 'radio', required: false, options: [], sortOrder: 1 },
          ],
        }),
      ).rejects.toBeDefined();

      expect(await repo.list({ activeOnly: false })).toHaveLength(0);
    });
  });

  describe('list', () => {
    it('returns everything, including switched-off rows, for the admin view', async () => {
      await seedSchool();
      const college = await repo.create({
        code: 'COL',
        name: 'College',
        description: null,
        questions: [],
        actorId: null,
      });
      await repo.setActive(college.id, false, null);

      const all = await repo.list({ activeOnly: false });
      expect(all.map((c) => c.code).sort()).toEqual(['COL', 'SCH']);
    });

    it('orders by name, ignoring case, with code breaking ties', async () => {
      const make = (code: string, name: string) =>
        repo.create({ code, name, description: null, questions: [], actorId: null });

      // The codes are chosen so their alphabetical order is NOTHING like the names' — otherwise
      // this test would pass just as happily against the old ORDER BY code. Mixed case matters
      // too: under a byte-order collation a plain ORDER BY name puts every uppercase entry
      // before every lowercase one, giving Apple, Mango, banana, mango, zebra.
      await make('Z9', 'Apple');
      await make('M5', 'banana');
      await make('A1', 'Mango');
      await make('A2', 'mango');
      await make('B3', 'zebra');

      const names = (await repo.list({ activeOnly: false })).map((c) => `${c.name}/${c.code}`);

      // Case-insensitive by name; the two spellings of "mango" tie and fall back to code order.
      expect(names).toEqual(['Apple/Z9', 'banana/M5', 'Mango/A1', 'mango/A2', 'zebra/B3']);
    });

    it('filters switched-off categories AND retired questions for the public view', async () => {
      const school = await repo.create({
        code: 'SCH',
        name: 'School',
        description: null,
        actorId: null,
        questions: [
          { text: 'Visible', type: 'radio', required: false, options: ['Yes'], sortOrder: 1 },
          { text: 'Retired', type: 'radio', required: false, options: ['Yes'], sortOrder: 2 },
        ],
      });
      const hidden = await repo.create({
        code: 'HID',
        name: 'Hidden',
        description: null,
        questions: [],
        actorId: null,
      });
      await repo.setActive(hidden.id, false, null);

      const retiredId = school.questions[1]?.id as string;
      const current = await repo.findById(school.id);
      await repo.applyUpdate({
        id: school.id,
        expectedVersion: current?.version as number,
        patch: {},
        actorId: null,
        plan: { ...EMPTY_PLAN, deactivate: [retiredId] },
      });

      const publicView = await repo.list({ activeOnly: true });
      expect(publicView.map((c) => c.code)).toEqual(['SCH']);
      expect(publicView[0]?.questions.map((q) => q.text)).toEqual(['Visible']);
    });

    it('loads every category AND its questions in exactly ONE query', async () => {
      await seedSchool();
      for (const code of ['COL', 'BRD', 'UNI', 'ACD']) {
        await repo.create({
          code,
          name: code,
          description: null,
          actorId: null,
          questions: [
            { text: `${code} q1`, type: 'radio', required: false, options: ['Yes'], sortOrder: 1 },
            { text: `${code} q2`, type: 'radio', required: false, options: ['Yes'], sortOrder: 2 },
          ],
        });
      }

      const counter = new SelectCountingLogger();
      const counted = new DataSource({
        ...buildDataSourceOptions(TEST_URL as string),
        logging: ['query'],
        logger: counter,
      });
      await counted.initialize();
      try {
        const countedRepo = new TypeOrmInstituteCategoryRepository(
          counted.getRepository(InstituteCategoryEntity),
          counted,
        );
        counter.selects = 0;
        const rows = await countedRepo.list({ activeOnly: false });

        expect(rows).toHaveLength(5);
        expect(rows.flatMap((c) => c.questions)).toHaveLength(10);
        // A per-category question fetch would make this 6. The join keeps it at 1.
        expect(counter.selects).toBe(1);
      } finally {
        await counted.destroy();
      }
    });

    it('still returns an active category that has no active questions', async () => {
      await repo.create({
        code: 'COL',
        name: 'College',
        description: null,
        questions: [],
        actorId: null,
      });

      const publicView = await repo.list({ activeOnly: true });
      expect(publicView).toHaveLength(1);
      expect(publicView[0]?.questions).toEqual([]);
    });
  });

  describe('applyUpdate — the optimistic-lock guard', () => {
    it('applies the patch and the question plan, and bumps the version', async () => {
      const school = await seedSchool();
      const keptId = school.questions[0]?.id as string;
      const droppedId = school.questions[1]?.id as string;

      const updated = expectUpdated(
        await repo.applyUpdate({
          id: school.id,
          expectedVersion: 1,
          patch: { name: 'Government School' },
          actorId: null,
          plan: {
            insert: [
              {
                text: 'Do you have a science lab?',
                type: 'radio',
                required: false,
                options: ['Yes', 'No'],
                sortOrder: 2,
              },
            ],
            update: [
              {
                id: keptId,
                text: 'Are you an ed-tech institute? (updated)',
                type: 'radio',
                required: true,
                options: ['Yes', 'No'],
                sortOrder: 1,
                isActive: true,
              },
            ],
            deactivate: [],
            remove: [droppedId],
          },
        }),
      );

      expect(updated.name).toBe('Government School');
      expect(updated.version).toBe(2);
      // The kept question holds the id it was created with — the whole point of the design.
      expect(updated.questions[0]?.id).toBe(keptId);
      expect(updated.questions.map((q) => q.text)).toEqual([
        'Are you an ed-tech institute? (updated)',
        'Do you have a science lab?',
      ]);
    });

    it('refuses a stale version and writes absolutely nothing', async () => {
      const school = await seedSchool();
      const firstQuestionId = school.questions[0]?.id as string;

      // First writer wins.
      const won = expectUpdated(
        await repo.applyUpdate({
          id: school.id,
          expectedVersion: 1,
          patch: { name: 'Saved by the first writer' },
          plan: EMPTY_PLAN,
          actorId: null,
        }),
      );
      expect(won.version).toBe(2);

      // Second writer submits the version it loaded — now stale.
      const lost = await repo.applyUpdate({
        id: school.id,
        expectedVersion: 1,
        patch: { name: 'Should never be saved' },
        actorId: null,
        plan: { ...EMPTY_PLAN, remove: [firstQuestionId] },
      });

      // Distinguishable from "no such category" — the caller needs 409 here, not 404.
      expect(lost).toEqual({ outcome: 'version-conflict' });

      const after = await repo.findById(school.id);
      expect(after?.name).toBe('Saved by the first writer');
      expect(after?.version).toBe(2);
      // Critical: the loser's question deletion was rolled back with its category update.
      expect(after?.questions.map((q) => q.id)).toContain(firstQuestionId);
    });

    it('retires a question without deleting it', async () => {
      const school = await seedSchool();
      const retiredId = school.questions[1]?.id as string;

      const updated = expectUpdated(
        await repo.applyUpdate({
          id: school.id,
          expectedVersion: 1,
          patch: {},
          actorId: null,
          plan: { ...EMPTY_PLAN, deactivate: [retiredId] },
        }),
      );

      const retired = updated.questions.find((q) => q.id === retiredId);
      expect(retired).toBeDefined();
      expect(retired?.isActive).toBe(false);
    });

    it('reports not-found — distinctly from a version conflict — for a missing category', async () => {
      const result = await repo.applyUpdate({
        id: '00000000-0000-4000-8000-000000000000',
        expectedVersion: 1,
        patch: { name: 'nope' },
        plan: EMPTY_PLAN,
        actorId: null,
      });

      expect(result).toEqual({ outcome: 'not-found' });
    });

    it('refuses to touch a question belonging to a different category', async () => {
      const school = await seedSchool();
      const college = await repo.create({
        code: 'COL',
        name: 'College',
        description: null,
        actorId: null,
        questions: [
          { text: 'College only', type: 'radio', required: false, options: ['Yes'], sortOrder: 1 },
        ],
      });
      const collegeQuestionId = college.questions[0]?.id as string;

      // A plan that names another category's question must not reach across the boundary.
      expectUpdated(
        await repo.applyUpdate({
          id: school.id,
          expectedVersion: school.version,
          patch: {},
          actorId: null,
          plan: { ...EMPTY_PLAN, remove: [collegeQuestionId], deactivate: [collegeQuestionId] },
        }),
      );

      const collegeAfter = await repo.findById(college.id);
      expect(collegeAfter?.questions.map((q) => q.id)).toEqual([collegeQuestionId]);
      expect(collegeAfter?.questions[0]?.isActive).toBe(true);
    });

    it('reports a code collision rather than failing opaquely', async () => {
      await seedSchool();
      const college = await repo.create({
        code: 'COL',
        name: 'College',
        description: null,
        questions: [],
        actorId: null,
      });

      await expect(
        repo.applyUpdate({
          id: college.id,
          expectedVersion: college.version,
          patch: { code: 'SCH' },
          plan: EMPTY_PLAN,
          actorId: null,
        }),
      ).rejects.toBeInstanceOf(CategoryCodeAlreadyExistsError);
    });
  });

  describe('setActive', () => {
    it('switches a category off and bumps the version', async () => {
      const school = await seedSchool();

      const off = await repo.setActive(school.id, false, null);
      expect(off?.isActive).toBe(false);
      expect(off?.version).toBe(2);
    });

    it('returns null for a category that does not exist', async () => {
      expect(await repo.setActive('00000000-0000-4000-8000-000000000000', false, null)).toBeNull();
    });
  });

  describe('remove', () => {
    it('deletes the category and cascades to its questions', async () => {
      const school = await seedSchool();

      expect(await repo.remove(school.id)).toBe(true);
      expect(await repo.findById(school.id)).toBeNull();

      const remaining = await dataSource.getRepository(InstituteCategoryQuestionEntity).count();
      expect(remaining).toBe(0);
    });

    it('reports false when nothing was deleted', async () => {
      expect(await repo.remove('00000000-0000-4000-8000-000000000000')).toBe(false);
    });
  });
});
