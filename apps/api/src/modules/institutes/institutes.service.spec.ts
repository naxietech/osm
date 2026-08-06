import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { InstitutionType, Province } from '@oses/types';

import { InstitutesService } from './institutes.service';
import {
  type AccountLookup,
  type CategoryLookup,
  type CategorySummary,
  InstituteCodeAlreadyExistsError,
  type InstituteDependants,
  type InstituteRecord,
  type InstituteRepository,
} from './ports';

const CATEGORY: CategorySummary = {
  id: '11111111-1111-4111-8111-111111111111',
  isActive: true,
  questions: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      text: 'Are you an ed-tech institute?',
      type: 'radio',
      required: true,
      options: ['Yes', 'No'],
      isActive: true,
    },
  ],
};

const VALID_ANSWER = { questionId: CATEGORY.questions[0]!.id, values: ['Yes'] };

function registration(over: Record<string, unknown> = {}) {
  return {
    instituteCode: 'S01',
    instituteName: 'Government High School',
    branch: undefined,
    categoryId: CATEGORY.id,
    institutionType: InstitutionType.GOVERNMENT,
    address: '1 Mall Road',
    city: 'Lahore',
    province: Province.PUNJAB,
    postalCode: undefined,
    contactPersonName: 'Ayesha Khan',
    contactPersonDesignation: 'Principal',
    contactEmail: 'principal@example.pk',
    contactPhone: '+92-42-1234567',
    answers: [VALID_ANSWER],
    password: 'a-strong-password',
    ...over,
  } as Parameters<InstitutesService['register']>[0];
}

function record(over: Partial<InstituteRecord> = {}): InstituteRecord {
  return {
    id: 'inst-1',
    instituteCode: 'S01',
    numericCode: null,
    instituteName: 'Government High School',
    branch: null,
    categoryId: CATEGORY.id,
    institutionType: InstitutionType.GOVERNMENT,
    address: '1 Mall Road',
    city: 'Lahore',
    province: Province.PUNJAB,
    postalCode: null,
    contactPersonName: 'Ayesha Khan',
    contactPersonDesignation: 'Principal',
    contactEmail: 'principal@example.pk',
    contactPhone: '+92-42-1234567',
    status: 'pending',
    rejectionReason: null,
    registrationSource: 'public',
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    answers: [VALID_ANSWER],
    ...over,
  };
}

interface Harness {
  service: InstitutesService;
  institutes: jest.Mocked<InstituteRepository>;
  categories: jest.Mocked<CategoryLookup>;
  accounts: jest.Mocked<AccountLookup>;
  dependants: jest.Mocked<InstituteDependants>;
}

function build(over: { category?: CategorySummary | null } = {}): Harness {
  const institutes = {
    list: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findById: jest.fn().mockResolvedValue(record()),
    isCodeTaken: jest.fn().mockResolvedValue(false),
    create: jest.fn().mockImplementation((input) => Promise.resolve(record(input))),
    update: jest.fn().mockImplementation((_id, patch) => Promise.resolve(record(patch))),
    softDelete: jest.fn().mockResolvedValue(true),
    findDuplicateCandidates: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<InstituteRepository>;

  const categories = {
    findById: jest.fn().mockResolvedValue(over.category === undefined ? CATEGORY : over.category),
  } as unknown as jest.Mocked<CategoryLookup>;

  const accounts = {
    isEmailTaken: jest.fn().mockResolvedValue(false),
  } as unknown as jest.Mocked<AccountLookup>;

  const dependants = {
    count: jest.fn().mockResolvedValue({ users: 0, students: 0, exams: 0 }),
    deactivateUsers: jest.fn().mockResolvedValue(0),
    releaseAllocations: jest.fn().mockResolvedValue(0),
    deactivateEvaluators: jest.fn().mockResolvedValue(0),
    deactivateStudents: jest.fn().mockResolvedValue(0),
  } as unknown as jest.Mocked<InstituteDependants>;

  return {
    service: new InstitutesService(institutes, categories, accounts, dependants),
    institutes,
    categories,
    accounts,
    dependants,
  };
}

describe('InstitutesService', () => {
  describe('public registration', () => {
    it('creates a pending row and nothing else', async () => {
      const { service, institutes } = build();
      await service.register(registration());

      expect(institutes.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending', registrationSource: 'public' }),
      );
    });

    it('hashes the password before it reaches the repository', async () => {
      const { service, institutes } = build();
      await service.register(registration({ password: 'a-strong-password' }));

      const passed = institutes.create.mock.calls[0]![0].passwordHash;
      expect(passed).toEqual(expect.stringContaining('$argon2id$'));
      expect(passed).not.toContain('a-strong-password');
    });

    it('tells the applicant only what they submitted', async () => {
      // The public receipt is four fields. Nothing about status of other institutes, no
      // internal ids beyond their own, no category detail.
      const { service } = build();
      const receipt = await service.register(registration());

      expect(Object.keys(receipt).sort()).toEqual([
        'id',
        'instituteCode',
        'instituteName',
        'status',
      ]);
      expect(receipt.status).toBe('pending');
    });

    it('rejects an unknown category', async () => {
      const { service } = build({ category: null });
      await expect(service.register(registration())).rejects.toThrow(BadRequestException);
    });

    it('rejects a category that has been switched off', async () => {
      const { service } = build({ category: { ...CATEGORY, isActive: false } });
      await expect(service.register(registration())).rejects.toThrow(
        /no longer accepting registrations/i,
      );
    });

    it('refuses a code that is already registered', async () => {
      const { service, institutes } = build();
      institutes.isCodeTaken.mockResolvedValue(true);

      await expect(service.register(registration())).rejects.toThrow(ConflictException);
      expect(institutes.create).not.toHaveBeenCalled();
    });

    it('answers 409 when the unique index catches a race the pre-check missed', async () => {
      // Two submissions can both pass isCodeTaken. The loser must get a 409, not a 500.
      const { service, institutes } = build();
      institutes.create.mockRejectedValue(new InstituteCodeAlreadyExistsError('S01'));

      await expect(service.register(registration())).rejects.toThrow(ConflictException);
    });

    it('refuses a category that requires a file upload', async () => {
      const { service } = build({
        category: {
          ...CATEGORY,
          questions: [
            {
              id: 'f1',
              text: 'Upload your charter',
              type: 'file',
              required: true,
              options: [],
              isActive: true,
            },
          ],
        },
      });
      await expect(service.register(registration({ answers: [] }))).rejects.toThrow(
        /requires a file upload/i,
      );
    });

    it('refuses when a required question was not answered', async () => {
      const { service } = build();
      await expect(service.register(registration({ answers: [] }))).rejects.toThrow(
        /must be answered/i,
      );
    });
  });

  describe('super admin creates one directly', () => {
    it('lands approved rather than pending', async () => {
      const { service, institutes } = build();
      await service.createByAdmin(registration(), 'actor-1');

      expect(institutes.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved', registrationSource: 'admin' }),
      );
    });

    it('stores no credential — that account is made through the users screen', async () => {
      const { service, institutes } = build();
      await service.createByAdmin(registration(), 'actor-1');

      expect(institutes.create.mock.calls[0]![0].passwordHash).toBeNull();
    });

    it('applies exactly the same validation as the public path', async () => {
      const { service } = build();
      await expect(service.createByAdmin(registration({ answers: [] }), 'actor-1')).rejects.toThrow(
        /must be answered/i,
      );
    });
  });

  describe('listing', () => {
    it('counts under the same filters as the page it returns', async () => {
      // Otherwise the UI can say "showing 10 of 3".
      const { service, institutes } = build();
      await service.listInstitutes({ limit: 25, offset: 0, status: 'pending', q: 'lahore' });

      expect(institutes.count).toHaveBeenCalledWith({
        search: 'lahore',
        status: 'pending',
        categoryId: undefined,
      });
    });
  });

  describe('detail', () => {
    it('surfaces same-name same-city institutes as a warning', async () => {
      const { service, institutes } = build();
      institutes.findDuplicateCandidates.mockResolvedValue([
        {
          id: 'other',
          instituteName: 'Government High School',
          branch: null,
          city: 'Lahore',
          status: 'approved',
        },
      ]);

      const detail = await service.getInstitute('inst-1');
      expect(detail.possibleDuplicates).toHaveLength(1);
      expect(detail.possibleDuplicates[0]!.id).toBe('other');
    });

    it('never counts the institute itself as its own duplicate', async () => {
      const { service, institutes } = build();
      await service.getInstitute('inst-1');

      expect(institutes.findDuplicateCandidates).toHaveBeenCalledWith(
        'Government High School',
        'Lahore',
        'inst-1',
      );
    });

    it('404s for an institute that does not exist', async () => {
      const { service, institutes } = build();
      institutes.findById.mockResolvedValue(null);

      await expect(service.getInstitute('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleting', () => {
    it('allows it while nothing is attached', async () => {
      const { service, institutes } = build();
      await expect(service.deleteInstitute('inst-1', 'actor-1')).resolves.toEqual({
        message: 'Institute deleted.',
      });
      expect(institutes.softDelete).toHaveBeenCalledWith('inst-1');
    });

    it('refuses once anything is attached, and says what', async () => {
      const { service, institutes, dependants } = build();
      dependants.count.mockResolvedValue({ users: 3, students: 0, exams: 0 });

      await expect(service.deleteInstitute('inst-1', 'actor-1')).rejects.toThrow(
        /it has 3 users\. Deactivate it instead/,
      );
      expect(institutes.softDelete).not.toHaveBeenCalled();
    });

    it('lists every kind of attachment, not just the first', async () => {
      const { service, dependants } = build();
      dependants.count.mockResolvedValue({ users: 1, students: 120, exams: 2 });

      await expect(service.deleteInstitute('inst-1', 'actor-1')).rejects.toThrow(
        /1 user, 120 students and 2 exams/,
      );
    });

    it('404s for an institute that does not exist', async () => {
      const { service, institutes } = build();
      institutes.findById.mockResolvedValue(null);

      await expect(service.deleteInstitute('nope', 'actor-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('availability check', () => {
    it('answers about both fields when both are asked', async () => {
      const { service, institutes, accounts } = build();
      institutes.isCodeTaken.mockResolvedValue(true);
      accounts.isEmailTaken.mockResolvedValue(false);

      await expect(
        service.checkAvailability({ instituteCode: 'S01', contactEmail: 'a@b.pk' }),
      ).resolves.toEqual({ codeAvailable: false, emailAvailable: true });
    });

    it('answers null — never a guess — for a field that was not asked about', async () => {
      const { service, accounts } = build();

      const result = await service.checkAvailability({ instituteCode: 'S01' });
      expect(result.emailAvailable).toBeNull();
      expect(accounts.isEmailTaken).not.toHaveBeenCalled();
    });
  });

  describe('editing', () => {
    it('writes the patch through', async () => {
      const { service, institutes } = build();
      await service.updateInstitute('inst-1', { city: 'Karachi' }, 'actor-1');

      expect(institutes.update).toHaveBeenCalledWith('inst-1', { city: 'Karachi' }, 'actor-1');
    });

    it('404s for an institute that does not exist', async () => {
      const { service, institutes } = build();
      institutes.findById.mockResolvedValue(null);

      await expect(service.updateInstitute('nope', { city: 'X' }, 'a')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
