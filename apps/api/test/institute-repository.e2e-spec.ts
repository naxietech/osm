import { DataSource } from 'typeorm';

import { InstitutionType, Province } from '@oses/types';

import type { CreateInstituteInput } from '../src/modules/institutes/ports';
import { createDataSource } from '../src/persistence/typeorm/data-source';
import {
  InstituteCategoryEntity,
  InstituteCategoryQuestionEntity,
  InstituteCredentialEntity,
  InstituteEntity,
  InstituteQuestionAnswerEntity,
} from '../src/persistence/typeorm/entities';
import { TypeOrmCategoryReferenceProbe } from '../src/persistence/typeorm/repositories/institute-support.repositories';
import { TypeOrmInstituteRepository } from '../src/persistence/typeorm/repositories/institute.repository';
import { resetInstituteData } from './reset-db';
import { requireTestDatabaseUrl } from './test-database';

// Integration test — needs a reachable Postgres. Point DATABASE_URL_TEST (or DATABASE_URL) at
// the oses_test database. Skips cleanly when neither is set.
const TEST_URL = requireTestDatabaseUrl();

/** Any uuid — the FK is to users, and these tests seed no users, so it stays null-checked below. */
const ACTOR_ID = null as unknown as string;

describe('Institute persistence (integration)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmInstituteRepository;
  let probe: TypeOrmCategoryReferenceProbe;
  let categoryId: string;
  let questionId: string;

  /**
   * The address follows the code. One live institute per contact address is a unique index, so a
   * test asking for a second institute by overriding the code was asking for a duplicate address
   * without meaning to.
   */
  const details = (over: Partial<CreateInstituteInput> = {}): CreateInstituteInput => ({
    contactEmail: `${(over.instituteCode ?? 'S01').toLowerCase()}@example.pk`,
    instituteCode: 'S01',
    instituteName: 'Government High School',
    branch: null,
    categoryId,
    institutionType: InstitutionType.GOVERNMENT,
    address: '1 Mall Road',
    city: 'Lahore',
    province: Province.PUNJAB,
    postalCode: null,
    contactPersonName: 'Ayesha Khan',
    contactPersonDesignation: 'Principal',
    contactPhone: '+92-42-1234567',
    answers: [],
    status: 'pending',
    registrationSource: 'public',
    passwordHash: null,
    actorId: null,
    ...over,
  });

  beforeAll(async () => {
    dataSource = createDataSource(TEST_URL);
    await dataSource.initialize();
    await dataSource.runMigrations();
    repo = new TypeOrmInstituteRepository(dataSource.getRepository(InstituteEntity), dataSource);
    probe = new TypeOrmCategoryReferenceProbe(
      dataSource.getRepository(InstituteQuestionAnswerEntity),
      dataSource.getRepository(InstituteEntity),
    );
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await resetInstituteData(dataSource);
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
  });

  describe('create', () => {
    it('stores a pending institute with no numeric code', async () => {
      const record = await repo.create(details());
      expect(record.status).toBe('pending');
      expect(record.numericCode).toBeNull();
    });

    it('draws a numeric code when the row arrives approved', async () => {
      const record = await repo.create(details({ status: 'approved' }));
      expect(record.numericCode).toEqual(expect.any(Number));
    });

    it('never issues the same numeric code twice', async () => {
      const first = await repo.create(details({ status: 'approved', instituteCode: 'A1' }));
      const second = await repo.create(details({ status: 'approved', instituteCode: 'A2' }));
      expect(first.numericCode).not.toEqual(second.numericCode);
    });

    it('stores the answers alongside the institute', async () => {
      const record = await repo.create(details({ answers: [{ questionId, values: ['Yes'] }] }));
      expect(record.answers).toEqual([{ questionId, values: ['Yes'] }]);
    });

    it('keeps the password hash out of the institute record entirely', async () => {
      // The credential lives in its own table precisely so no read of an institute can reach it.
      const record = await repo.create(details({ passwordHash: '$argon2id$fake' }));
      expect(JSON.stringify(record)).not.toContain('argon2id');

      const stored = await dataSource
        .getRepository(InstituteCredentialEntity)
        .findOne({ where: { instituteId: record.id } });
      expect(stored?.passwordHash).toBe('$argon2id$fake');
    });

    it('rolls the whole insert back when an answer points at an unknown question', async () => {
      await expect(
        repo.create(details({ answers: [{ questionId: crypto.randomUUID(), values: ['Yes'] }] })),
      ).rejects.toThrow();

      const count = await dataSource.getRepository(InstituteEntity).count();
      expect(count).toBe(0);
    });
  });

  describe('code availability', () => {
    it('reports a live code as taken', async () => {
      await repo.create(details());
      await expect(repo.isCodeTaken('S01')).resolves.toBe(true);
    });

    it('is case-insensitive, so s01 cannot shadow S01', async () => {
      await repo.create(details());
      await expect(repo.isCodeTaken('s01')).resolves.toBe(true);
    });

    it('frees the code once the institute is soft-deleted', async () => {
      const record = await repo.create(details());
      await repo.softDelete(record.id, ACTOR_ID);
      await expect(repo.isCodeTaken('S01')).resolves.toBe(false);
    });

    it('lets a second institute register the freed code', async () => {
      const first = await repo.create(details());
      await repo.softDelete(first.id, ACTOR_ID);
      await expect(repo.create(details())).resolves.toMatchObject({ instituteCode: 'S01' });
    });
  });

  describe('reads', () => {
    it('hides a soft-deleted institute from findById', async () => {
      const record = await repo.create(details());
      await repo.softDelete(record.id, ACTOR_ID);
      await expect(repo.findById(record.id)).resolves.toBeNull();
    });

    it('hides a soft-deleted institute from the listing and its total', async () => {
      const record = await repo.create(details());
      await repo.softDelete(record.id, ACTOR_ID);
      await expect(repo.list({ limit: 25, offset: 0 })).resolves.toEqual([]);
      await expect(repo.count({})).resolves.toBe(0);
    });

    it('searches name, code and city together', async () => {
      await repo.create(details({ instituteName: 'Beaconhouse', instituteCode: 'B1' }));
      await expect(repo.list({ limit: 25, offset: 0, search: 'beacon' })).resolves.toHaveLength(1);
      await expect(repo.list({ limit: 25, offset: 0, search: 'B1' })).resolves.toHaveLength(1);
      await expect(repo.list({ limit: 25, offset: 0, search: 'lahore' })).resolves.toHaveLength(1);
    });

    it('carries each institute its own answers on a listing page', async () => {
      await repo.create(details({ answers: [{ questionId, values: ['Yes'] }] }));
      await repo.create(
        details({ instituteCode: 'S02', answers: [{ questionId, values: ['No'] }] }),
      );

      const page = await repo.list({ limit: 25, offset: 0 });
      expect(page.map((row) => row.answers[0]?.values[0]).sort()).toEqual(['No', 'Yes']);
    });

    it('finds a same-name same-city institute but never the one asking', async () => {
      const first = await repo.create(details());
      await repo.create(details({ instituteCode: 'S02' }));

      const found = await repo.findDuplicateCandidates(
        'government high school',
        'LAHORE',
        first.id,
      );
      expect(found).toHaveLength(1);
      expect(found[0]!.id).not.toBe(first.id);
    });
  });

  describe('CategoryReferenceProbe — now backed by real data', () => {
    // Module 1 shipped its retire-instead-of-delete rules against a placeholder that always
    // answered "nothing references this". These are the first tests where it can answer truthfully.
    it('finds a question that an institute has answered', async () => {
      await repo.create(details({ answers: [{ questionId, values: ['Yes'] }] }));
      await expect(probe.questionsWithAnswers([questionId])).resolves.toEqual(
        new Set([questionId]),
      );
    });

    it('reports an unanswered question as free', async () => {
      await repo.create(details());
      await expect(probe.questionsWithAnswers([questionId])).resolves.toEqual(new Set());
    });

    it('answers an empty batch without touching the database', async () => {
      await expect(probe.questionsWithAnswers([])).resolves.toEqual(new Set());
    });

    it('reports a category as in use once an institute is filed under it', async () => {
      await repo.create(details());
      await expect(probe.isCategoryInUse(categoryId)).resolves.toBe(true);
    });

    it('still reports it in use after the institute is soft-deleted', async () => {
      // The row is retained deliberately, and it still points at the category. Letting the
      // category go would break the record we chose to keep.
      const record = await repo.create(details());
      await repo.softDelete(record.id, ACTOR_ID);
      await expect(probe.isCategoryInUse(categoryId)).resolves.toBe(true);
    });

    it('reports an unused category as free', async () => {
      await expect(probe.isCategoryInUse(categoryId)).resolves.toBe(false);
    });
  });

  describe('the database has the last word', () => {
    it('refuses to delete a question an institute has answered', async () => {
      await repo.create(details({ answers: [{ questionId, values: ['Yes'] }] }));
      await expect(
        dataSource.getRepository(InstituteCategoryQuestionEntity).delete({ id: questionId }),
      ).rejects.toThrow();
    });

    it('refuses to delete a category an institute is filed under', async () => {
      await repo.create(details());
      await expect(
        dataSource.getRepository(InstituteCategoryEntity).delete({ id: categoryId }),
      ).rejects.toThrow();
    });

    it('takes the answers and the credential with the institute when it is hard-deleted', async () => {
      const record = await repo.create(
        details({ answers: [{ questionId, values: ['Yes'] }], passwordHash: '$argon2id$fake' }),
      );
      await dataSource.getRepository(InstituteEntity).delete({ id: record.id });

      await expect(dataSource.getRepository(InstituteQuestionAnswerEntity).count()).resolves.toBe(
        0,
      );
      await expect(dataSource.getRepository(InstituteCredentialEntity).count()).resolves.toBe(0);
    });
  });
});
