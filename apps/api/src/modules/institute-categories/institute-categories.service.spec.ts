import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { InstituteCategoriesService } from './institute-categories.service';
import {
  type ApplyUpdateOutcome,
  CategoryCodeAlreadyExistsError,
  type CategoryReferenceProbe,
  type InstituteCategoryRecord,
  type InstituteCategoryRepository,
} from './ports';

const ACTOR = 'actor-uuid';
const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
const QUESTION_ID = '22222222-2222-4222-8222-222222222222';

function record(overrides: Partial<InstituteCategoryRecord> = {}): InstituteCategoryRecord {
  return {
    id: CATEGORY_ID,
    code: 'SCH',
    name: 'School',
    description: 'Schools',
    isActive: true,
    version: 3,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    questions: [
      {
        id: QUESTION_ID,
        text: 'Are you an ed-tech institute?',
        type: 'radio',
        required: true,
        options: ['Yes', 'No'],
        sortOrder: 1,
        isActive: true,
      },
    ],
    ...overrides,
  };
}

interface RepoMock {
  list: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  applyUpdate: jest.Mock;
  setActive: jest.Mock;
  remove: jest.Mock;
}

interface ProbeMock {
  questionsWithAnswers: jest.Mock;
  isCategoryInUse: jest.Mock;
}

describe('InstituteCategoriesService', () => {
  let repo: RepoMock;
  let probe: ProbeMock;
  let service: InstituteCategoriesService;

  beforeEach(() => {
    repo = {
      list: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      applyUpdate: jest.fn(),
      setActive: jest.fn(),
      remove: jest.fn(),
    };
    probe = {
      questionsWithAnswers: jest.fn().mockResolvedValue(new Set<string>()),
      isCategoryInUse: jest.fn().mockResolvedValue(false),
    };
    service = new InstituteCategoriesService(
      repo as unknown as InstituteCategoryRepository,
      probe as unknown as CategoryReferenceProbe,
    );
  });

  describe('reads', () => {
    it('returns the admin view including the version', async () => {
      repo.list.mockResolvedValue([record()]);

      const [category] = await service.listForAdmin();

      expect(repo.list).toHaveBeenCalledWith({ activeOnly: false });
      expect(category).toMatchObject({ code: 'SCH', isActive: true, version: 3 });
    });

    it('404s for a category that does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findForAdmin(CATEGORY_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('never exposes version or isActive on the public view', async () => {
      repo.list.mockResolvedValue([record()]);

      const [category] = await service.listPublic();

      expect(repo.list).toHaveBeenCalledWith({ activeOnly: true });
      expect(category).not.toHaveProperty('version');
      expect(category).not.toHaveProperty('isActive');
      expect(category?.questions[0]).not.toHaveProperty('sortOrder');
    });

    it('withholds retired questions from both views', async () => {
      const withRetired = record({
        questions: [
          ...record().questions,
          {
            id: 'retired',
            text: 'Old question',
            type: 'radio',
            required: false,
            options: ['Yes'],
            sortOrder: 2,
            isActive: false,
          },
        ],
      });
      repo.list.mockResolvedValue([withRetired]);

      const [adminView] = await service.listForAdmin();
      repo.list.mockResolvedValue([withRetired]);
      const [publicView] = await service.listPublic();

      expect(adminView?.questions.map((q) => q.id)).toEqual([QUESTION_ID]);
      expect(publicView?.questions.map((q) => q.id)).toEqual([QUESTION_ID]);
    });
  });

  describe('the public cache', () => {
    it('serves a second read without touching the database', async () => {
      repo.list.mockResolvedValue([record()]);

      await service.listPublic();
      await service.listPublic();

      expect(repo.list).toHaveBeenCalledTimes(1);
    });

    it('re-queries once the TTL has expired', async () => {
      jest.useFakeTimers();
      try {
        repo.list.mockResolvedValue([record()]);

        await service.listPublic();
        jest.advanceTimersByTime(59_000);
        await service.listPublic();
        expect(repo.list).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(2_000);
        await service.listPublic();
        expect(repo.list).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('collapses a cold-cache stampede into a single query', async () => {
      let release: (value: InstituteCategoryRecord[]) => void = () => {};
      repo.list.mockReturnValue(
        new Promise<InstituteCategoryRecord[]>((resolve) => {
          release = resolve;
        }),
      );

      const concurrent = Promise.all([
        service.listPublic(),
        service.listPublic(),
        service.listPublic(),
      ]);
      release([record()]);
      const results = await concurrent;

      expect(repo.list).toHaveBeenCalledTimes(1);
      expect(results.every((r) => r.length === 1)).toBe(true);
    });

    it('hands out a frozen array so one caller cannot corrupt it for everyone', async () => {
      repo.list.mockResolvedValue([record()]);

      const list = await service.listPublic();

      expect(Object.isFrozen(list)).toBe(true);
    });

    it('does not publish a load that finished after a write', async () => {
      let release: (value: InstituteCategoryRecord[]) => void = () => {};
      repo.list.mockReturnValueOnce(
        new Promise<InstituteCategoryRecord[]>((resolve) => {
          release = resolve;
        }),
      );
      repo.setActive.mockResolvedValue(record());

      const reading = service.listPublic();
      // A write lands while the read is still in flight.
      await service.setActive(CATEGORY_ID, { isActive: false }, ACTOR);
      release([record()]);
      await reading;

      // The pre-write result must not have been cached, so the next read goes back to the source.
      repo.list.mockResolvedValue([record()]);
      await service.listPublic();
      expect(repo.list).toHaveBeenCalledTimes(2);
    });

    it.each([
      [
        'create',
        async (s: InstituteCategoriesService) => s.create({ code: 'X', name: 'X' }, ACTOR),
      ],
      [
        'update',
        async (s: InstituteCategoriesService) => s.update(CATEGORY_ID, { version: 3 }, ACTOR),
      ],
      [
        'status change',
        async (s: InstituteCategoriesService) =>
          s.setActive(CATEGORY_ID, { isActive: false }, ACTOR),
      ],
      ['delete', async (s: InstituteCategoriesService) => s.remove(CATEGORY_ID)],
    ])('is dropped after a %s so the public list never goes stale', async (_label, mutate) => {
      repo.list.mockResolvedValue([record()]);
      repo.create.mockResolvedValue(record());
      repo.findById.mockResolvedValue(record());
      repo.applyUpdate.mockResolvedValue({ outcome: 'updated', category: record() });
      repo.setActive.mockResolvedValue(record());
      repo.remove.mockResolvedValue(true);

      await service.listPublic();
      await mutate(service);
      await service.listPublic();

      expect(repo.list).toHaveBeenCalledTimes(2);
    });
  });

  describe('create', () => {
    it('numbers questions from 1 and fills in the optional fields', async () => {
      repo.create.mockResolvedValue(record());

      await service.create(
        {
          code: 'SCH',
          name: 'School',
          questions: [
            { text: 'First', type: 'text' },
            { text: 'Second', type: 'radio', required: true, options: ['Yes', 'No'] },
          ],
        },
        ACTOR,
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
          actorId: ACTOR,
          questions: [
            { text: 'First', type: 'text', required: false, options: [], sortOrder: 1 },
            { text: 'Second', type: 'radio', required: true, options: ['Yes', 'No'], sortOrder: 2 },
          ],
        }),
      );
    });

    it('turns a duplicate code into a 409 rather than a 500', async () => {
      repo.create.mockRejectedValue(new CategoryCodeAlreadyExistsError('SCH'));

      await expect(service.create({ code: 'SCH', name: 'School' }, ACTOR)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      repo.findById.mockResolvedValue(record());
      repo.applyUpdate.mockResolvedValue({ outcome: 'updated', category: record() });
    });

    it('leaves the question list untouched when `questions` is omitted', async () => {
      await service.update(CATEGORY_ID, { version: 3, name: 'Renamed' }, ACTOR);

      expect(repo.applyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedVersion: 3,
          patch: { name: 'Renamed' },
          plan: { insert: [], update: [], deactivate: [], remove: [] },
        }),
      );
      expect(probe.questionsWithAnswers).not.toHaveBeenCalled();
    });

    it('clears the question list when an empty array is sent', async () => {
      await service.update(CATEGORY_ID, { version: 3, questions: [] }, ACTOR);

      expect(repo.applyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ plan: expect.objectContaining({ remove: [QUESTION_ID] }) }),
      );
    });

    it('preserves an existing question id rather than replacing the row', async () => {
      await service.update(
        CATEGORY_ID,
        {
          version: 3,
          questions: [
            {
              id: QUESTION_ID,
              text: 'Are you an ed-tech institute?',
              type: 'radio',
              required: true,
              options: ['Yes', 'No'],
            },
          ],
        },
        ACTOR,
      );

      expect(repo.applyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: {
            update: [expect.objectContaining({ id: QUESTION_ID, sortOrder: 1 })],
            insert: [],
            deactivate: [],
            remove: [],
          },
        }),
      );
    });

    it('400s when a submitted question belongs to another category', async () => {
      await expect(
        service.update(
          CATEGORY_ID,
          {
            version: 3,
            questions: [
              {
                id: '99999999-9999-4999-8999-999999999999',
                text: 'Foreign',
                type: 'radio',
                options: ['Yes'],
              },
            ],
          },
          ACTOR,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('409s when a change would invalidate stored answers', async () => {
      probe.questionsWithAnswers.mockResolvedValue(new Set([QUESTION_ID]));

      await expect(
        service.update(
          CATEGORY_ID,
          {
            version: 3,
            questions: [
              {
                id: QUESTION_ID,
                text: 'Are you an ed-tech institute?',
                type: 'checkbox',
                options: ['Yes', 'No'],
              },
            ],
          },
          ACTOR,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('409s — not 404s — when someone else saved first', async () => {
      repo.applyUpdate.mockResolvedValue({ outcome: 'version-conflict' } as ApplyUpdateOutcome);

      await expect(service.update(CATEGORY_ID, { version: 1 }, ACTOR)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('404s — not 409s — when the category disappeared mid-edit', async () => {
      repo.applyUpdate.mockResolvedValue({ outcome: 'not-found' } as ApplyUpdateOutcome);

      await expect(service.update(CATEGORY_ID, { version: 3 }, ACTOR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('404s before doing any work when the category is already gone', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.update(CATEGORY_ID, { version: 3 }, ACTOR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.applyUpdate).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('refuses while an institute still uses the category', async () => {
      probe.isCategoryInUse.mockResolvedValue(true);

      await expect(service.remove(CATEGORY_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('404s when nothing was deleted', async () => {
      repo.remove.mockResolvedValue(false);

      await expect(service.remove(CATEGORY_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('status', () => {
    it('404s for a category that does not exist', async () => {
      repo.setActive.mockResolvedValue(null);

      await expect(
        service.setActive(CATEGORY_ID, { isActive: false }, ACTOR),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
