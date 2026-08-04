import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { ClassesService } from './classes.service';
import {
  type ApplyClassUpdateOutcome,
  ClassNameAlreadyExistsError,
  type ClassRecord,
  type ClassRepository,
} from './ports';

const ACTOR = 'actor-uuid';
const CLASS_ID = '11111111-1111-4111-8111-111111111111';
const SCIENCE = '22222222-2222-4222-8222-222222222222';
const BIOLOGY = '33333333-3333-4333-8333-333333333333';
const STRANGER = '99999999-9999-4999-8999-999999999999';

function record(overrides: Partial<ClassRecord> = {}): ClassRecord {
  return {
    id: CLASS_ID,
    name: 'Class 9',
    ordinal: 9,
    description: 'Secondary — SSC Part I',
    isActive: true,
    version: 3,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    groups: [
      { id: SCIENCE, parentId: null, name: 'Science', sortOrder: 1, isActive: true },
      { id: BIOLOGY, parentId: SCIENCE, name: 'Biology', sortOrder: 1, isActive: true },
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
}

describe('ClassesService', () => {
  let repo: RepoMock;
  let service: ClassesService;

  beforeEach(() => {
    repo = {
      list: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      applyUpdate: jest.fn(),
      setActive: jest.fn(),
    };
    service = new ClassesService(repo as unknown as ClassRepository);
  });

  describe('reads', () => {
    it('returns the nested tree with the version', async () => {
      repo.list.mockResolvedValue([record()]);

      const [cls] = await service.list(false);

      expect(repo.list).toHaveBeenCalledWith({ activeOnly: false });
      expect(cls).toMatchObject({ name: 'Class 9', ordinal: 9, version: 3 });
      expect(cls?.groups).toEqual([
        {
          id: SCIENCE,
          name: 'Science',
          isActive: true,
          subgroups: [{ id: BIOLOGY, name: 'Biology', isActive: true }],
        },
      ]);
    });

    it('passes activeOnly through for pickers', async () => {
      repo.list.mockResolvedValue([]);

      await service.list(true);

      expect(repo.list).toHaveBeenCalledWith({ activeOnly: true });
    });

    it('withholds deactivated groups, so a save cannot echo them back as "keep this"', async () => {
      repo.list.mockResolvedValue([
        record({
          groups: [
            { id: SCIENCE, parentId: null, name: 'Science', sortOrder: 1, isActive: false },
            { id: BIOLOGY, parentId: SCIENCE, name: 'Biology', sortOrder: 1, isActive: true },
          ],
        }),
      ]);

      const [cls] = await service.list(false);

      expect(cls?.groups).toEqual([]);
    });

    it('404s for a class that does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findById(CLASS_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('flattens the submitted tree and defaults a missing description to null', async () => {
      repo.create.mockResolvedValue(record());

      await service.create(
        {
          name: 'Class 9',
          ordinal: 9,
          groups: [{ name: 'Science', subgroups: [{ name: 'Biology' }] }],
        },
        ACTOR,
      );

      expect(repo.create).toHaveBeenCalledWith({
        name: 'Class 9',
        ordinal: 9,
        description: null,
        groups: [{ name: 'Science', sortOrder: 1, subgroups: ['Biology'] }],
        actorId: ACTOR,
      });
    });

    it('turns a duplicate class name into a 409, never a 500', async () => {
      repo.create.mockRejectedValue(new ClassNameAlreadyExistsError('Class 9'));

      await expect(service.create({ name: 'Class 9', ordinal: 9 }, ACTOR)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      repo.findById.mockResolvedValue(record());
      repo.applyUpdate.mockResolvedValue({
        outcome: 'updated',
        class: record(),
      } satisfies ApplyClassUpdateOutcome);
    });

    it('404s before doing any work when the class is gone', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.update(CLASS_ID, { version: 3 }, ACTOR)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.applyUpdate).not.toHaveBeenCalled();
    });

    it('leaves the stored tree alone when groups is omitted', async () => {
      await service.update(CLASS_ID, { version: 3, name: 'Class Nine' }, ACTOR);

      expect(repo.applyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ plan: null, patch: { name: 'Class Nine' } }),
      );
    });

    it('clears the tree when groups is an empty array', async () => {
      await service.update(CLASS_ID, { version: 3, groups: [] }, ACTOR);

      const { plan } = repo.applyUpdate.mock.calls[0][0];
      expect(plan.deactivate).toEqual([SCIENCE, BIOLOGY]);
    });

    it('sends only the fields the caller supplied', async () => {
      await service.update(CLASS_ID, { version: 3, ordinal: 10 }, ACTOR);

      expect(repo.applyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ patch: { ordinal: 10 }, expectedVersion: 3 }),
      );
    });

    it('passes a null description through, so it can actually be cleared', async () => {
      await service.update(CLASS_ID, { version: 3, description: null }, ACTOR);

      expect(repo.applyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ patch: { description: null } }),
      );
    });

    it('builds the tree plan from the stored tree', async () => {
      await service.update(
        CLASS_ID,
        {
          version: 3,
          groups: [
            {
              id: SCIENCE,
              name: 'Science',
              subgroups: [{ id: BIOLOGY, name: 'Biology' }, { name: 'Physics' }],
            },
          ],
        },
        ACTOR,
      );

      const { plan } = repo.applyUpdate.mock.calls[0][0];
      expect(plan.insertSubgroups).toEqual([{ parentId: SCIENCE, name: 'Physics', sortOrder: 2 }]);
      expect(plan.deactivate).toEqual([]);
    });

    it('400s on a group id that belongs to another class', async () => {
      await expect(
        service.update(
          CLASS_ID,
          { version: 3, groups: [{ id: STRANGER, name: 'Science', subgroups: [] }] },
          ACTOR,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.applyUpdate).not.toHaveBeenCalled();
    });

    it('400s on a subgroup sent as a top-level group', async () => {
      await expect(
        service.update(
          CLASS_ID,
          { version: 3, groups: [{ id: BIOLOGY, name: 'Biology', subgroups: [] }] },
          ACTOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('409s when someone else saved first, and says to reload', async () => {
      repo.applyUpdate.mockResolvedValue({ outcome: 'version-conflict' });

      await expect(service.update(CLASS_ID, { version: 3 }, ACTOR)).rejects.toThrow(
        ConflictException,
      );
    });

    it('404s when the class disappeared between the read and the write', async () => {
      repo.applyUpdate.mockResolvedValue({ outcome: 'not-found' });

      await expect(service.update(CLASS_ID, { version: 3 }, ACTOR)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('turns a duplicate class name into a 409', async () => {
      repo.applyUpdate.mockRejectedValue(new ClassNameAlreadyExistsError('Class 10'));

      await expect(
        service.update(CLASS_ID, { version: 3, name: 'Class 10' }, ACTOR),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('setActive', () => {
    it('deactivates a class and returns it', async () => {
      repo.setActive.mockResolvedValue(record({ isActive: false }));

      const result = await service.setActive(CLASS_ID, { isActive: false }, ACTOR);

      expect(repo.setActive).toHaveBeenCalledWith(CLASS_ID, false, ACTOR);
      expect(result.isActive).toBe(false);
    });

    it('404s for a class that does not exist', async () => {
      repo.setActive.mockResolvedValue(null);

      await expect(service.setActive(CLASS_ID, { isActive: true }, ACTOR)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
