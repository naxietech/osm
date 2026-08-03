import { ConflictException, NotFoundException } from '@nestjs/common';

import { SubjectCodeAlreadyExistsError, type SubjectRecord, type SubjectRepository } from './ports';
import { SubjectsService } from './subjects.service';

const ACTOR = 'actor-uuid';
const SUBJECT_ID = '11111111-1111-4111-8111-111111111111';

function record(overrides: Partial<SubjectRecord> = {}): SubjectRecord {
  return {
    id: SUBJECT_ID,
    code: 'PHY',
    name: 'Physics',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

interface RepoMock {
  list: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  setActive: jest.Mock;
}

describe('SubjectsService', () => {
  let repo: RepoMock;
  let service: SubjectsService;

  beforeEach(() => {
    repo = {
      list: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setActive: jest.fn(),
    };
    service = new SubjectsService(repo as unknown as SubjectRepository);
  });

  describe('reads', () => {
    it('maps records to the shared Subject shape and nothing more', async () => {
      repo.list.mockResolvedValue([record()]);

      const result = await service.list(false);

      // Exactly these keys: timestamps and audit columns must not leak into a response, and
      // creditHours must stay absent rather than being invented as 0.
      expect(result).toEqual([{ id: SUBJECT_ID, code: 'PHY', name: 'Physics', isActive: true }]);
      expect(Object.keys(result[0] ?? {}).sort()).toEqual(['code', 'id', 'isActive', 'name']);
    });

    it('passes activeOnly through to the repository rather than filtering in memory', async () => {
      repo.list.mockResolvedValue([]);

      await service.list(true);

      expect(repo.list).toHaveBeenCalledWith({ activeOnly: true });
    });
  });

  describe('create', () => {
    it('creates the subject and stamps the actor', async () => {
      repo.create.mockResolvedValue(record());

      const result = await service.create({ code: 'PHY', name: 'Physics' }, ACTOR);

      expect(repo.create).toHaveBeenCalledWith({ code: 'PHY', name: 'Physics', actorId: ACTOR });
      expect(result).toEqual({ id: SUBJECT_ID, code: 'PHY', name: 'Physics', isActive: true });
    });

    it('turns a duplicate code into a 409, not a 500', async () => {
      repo.create.mockRejectedValue(new SubjectCodeAlreadyExistsError('PHY'));

      await expect(service.create({ code: 'PHY', name: 'Physics' }, ACTOR)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('lets an unrecognised repository failure through untouched', async () => {
      // A connection drop must stay a 500. Translating everything to a 409 would tell the user
      // their code was taken when the database was simply unreachable.
      const boom = new Error('connection terminated');
      repo.create.mockRejectedValue(boom);

      await expect(service.create({ code: 'PHY', name: 'Physics' }, ACTOR)).rejects.toBe(boom);
    });
  });

  describe('update', () => {
    it('sends only the fields the caller supplied', async () => {
      repo.update.mockResolvedValue(record({ name: 'Physics (Higher)' }));

      await service.update(SUBJECT_ID, { name: 'Physics (Higher)' }, ACTOR);

      // `code` must be absent, not `undefined` — an explicit undefined would invite a repository
      // to write it and blank the column.
      const [, patch] = repo.update.mock.calls[0] as [string, Record<string, unknown>, string];
      expect(patch).toEqual({ name: 'Physics (Higher)' });
      expect('code' in patch).toBe(false);
    });

    it('sends both fields when both are supplied', async () => {
      repo.update.mockResolvedValue(record());

      await service.update(SUBJECT_ID, { code: 'PHYS', name: 'Physics' }, ACTOR);

      expect(repo.update).toHaveBeenCalledWith(
        SUBJECT_ID,
        { code: 'PHYS', name: 'Physics' },
        ACTOR,
      );
    });

    it('404s when the subject is gone', async () => {
      repo.update.mockResolvedValue(null);

      await expect(service.update(SUBJECT_ID, { name: 'X' }, ACTOR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('turns a duplicate code into a 409', async () => {
      repo.update.mockRejectedValue(new SubjectCodeAlreadyExistsError('BIO'));

      await expect(service.update(SUBJECT_ID, { code: 'BIO' }, ACTOR)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('setActive', () => {
    it('deactivates and returns the updated subject', async () => {
      repo.setActive.mockResolvedValue(record({ isActive: false }));

      const result = await service.setActive(SUBJECT_ID, { isActive: false }, ACTOR);

      expect(repo.setActive).toHaveBeenCalledWith(SUBJECT_ID, false, ACTOR);
      expect(result.isActive).toBe(false);
    });

    it('reactivates too — the route is a target state, not a toggle', async () => {
      repo.setActive.mockResolvedValue(record({ isActive: true }));

      const result = await service.setActive(SUBJECT_ID, { isActive: true }, ACTOR);

      expect(repo.setActive).toHaveBeenCalledWith(SUBJECT_ID, true, ACTOR);
      expect(result.isActive).toBe(true);
    });

    it('404s when the subject is gone', async () => {
      repo.setActive.mockResolvedValue(null);

      await expect(
        service.setActive(SUBJECT_ID, { isActive: false }, ACTOR),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
