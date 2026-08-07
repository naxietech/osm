import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { InstitutionType, Province } from '@oses/types';

import type { ApprovalService } from './approval.service';
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
  approval: jest.Mocked<ApprovalService>;
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
    isContactEmailTaken: jest.fn().mockResolvedValue(false),
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

  const approval = {
    approve: jest.fn().mockImplementation((id: string) =>
      Promise.resolve({
        institute: { id, status: 'approved' },
        userId: 'user-1',
        message: 'Institute registered.',
      }),
    ),
  } as unknown as jest.Mocked<ApprovalService>;

  const dependants = {
    count: jest.fn().mockResolvedValue({ users: 0, students: 0, exams: 0 }),
    deactivateUsers: jest.fn().mockResolvedValue(0),
    releaseAllocations: jest.fn().mockResolvedValue(0),
    deactivateEvaluators: jest.fn().mockResolvedValue(0),
    deactivateStudents: jest.fn().mockResolvedValue(0),
  } as unknown as jest.Mocked<InstituteDependants>;

  return {
    approval,
    service: new InstitutesService(institutes, categories, accounts, dependants, approval),
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
    /**
     * The defect this replaces: an admin-entered institute landed `approved` with no account,
     * so the institute it named could never sign in — and nothing said so. Given a password it
     * now takes the same road a public registration does, because approval is where the numeric
     * code, the account, the audit entry and the atomicity already live.
     */
    it('registers the login alongside the record when a password is supplied', async () => {
      const { service, institutes, approval } = build();
      const result = await service.createByAdmin(registration(), 'actor-1');

      expect(institutes.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending', registrationSource: 'admin' }),
      );
      expect(approval.approve).toHaveBeenCalledWith('inst-1', { createLogin: true }, 'actor-1');
      expect(result.userId).toBe('user-1');
    });

    it('hashes that password before it reaches the repository', async () => {
      const { service, institutes } = build();
      await service.createByAdmin(registration({ password: 'a-strong-password' }), 'actor-1');

      const stored = institutes.create.mock.calls[0]![0].passwordHash;
      expect(stored).not.toBeNull();
      expect(stored).not.toContain('a-strong-password');
    });

    it('lands approved with no login when no password is given, and says so', async () => {
      // Legitimate — an institute whose accounts are managed separately — but it is also how one
      // ends up approved with nobody able to get in, so the message must not be silent about it.
      const { service, institutes, approval } = build();
      const result = await service.createByAdmin(registration({ password: undefined }), 'actor-1');

      expect(institutes.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved', passwordHash: null }),
      );
      expect(approval.approve).not.toHaveBeenCalled();
      expect(result.userId).toBeNull();
      expect(result.message).toMatch(/no login/i);
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
      // The actor is recorded on the row — a record that cannot say who ended it is not one.
      expect(institutes.softDelete).toHaveBeenCalledWith('inst-1', 'actor-1');
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

    /**
     * The bug this covers: the probe asked only about accounts. An institute that has registered
     * but not been approved yet holds its address without any account existing, so a second
     * applicant was told the address was free — and the two of them could not both be given a
     * login, which nobody would discover until approval, weeks later, by phone.
     */
    it('reports an address held by an unapproved institute as taken', async () => {
      const { service, institutes, accounts } = build();
      accounts.isEmailTaken.mockResolvedValue(false);
      institutes.isContactEmailTaken.mockResolvedValue(true);

      await expect(service.checkAvailability({ contactEmail: 'a@b.pk' })).resolves.toEqual({
        codeAvailable: null,
        emailAvailable: false,
      });
    });

    it('reports an address held by an account as taken, with no institute row needed', async () => {
      const { service, institutes, accounts } = build();
      accounts.isEmailTaken.mockResolvedValue(true);
      institutes.isContactEmailTaken.mockResolvedValue(false);

      await expect(service.checkAvailability({ contactEmail: 'a@b.pk' })).resolves.toEqual({
        codeAvailable: null,
        emailAvailable: false,
      });
    });
  });

  describe('refusing a duplicate address', () => {
    it('409s a public registration whose address another institute already holds', async () => {
      const { service, institutes } = build();
      institutes.isContactEmailTaken.mockResolvedValue(true);

      await expect(service.register(registration())).rejects.toThrow(ConflictException);
      expect(institutes.create).not.toHaveBeenCalled();
    });

    it('409s an admin-created institute on the same terms', async () => {
      // Same rule, both doors. An admin typing a duplicate address by hand produces exactly the
      // stranded institute the public check exists to prevent.
      const { service, institutes } = build();
      institutes.isContactEmailTaken.mockResolvedValue(true);

      await expect(service.createByAdmin(registration(), 'actor-1')).rejects.toThrow(
        ConflictException,
      );
      expect(institutes.create).not.toHaveBeenCalled();
    });
  });

  describe('editing', () => {
    it('writes the patch through, leaving the answers alone', async () => {
      const { service, institutes } = build();
      await service.updateInstitute('inst-1', { city: 'Karachi' }, 'actor-1');

      // `undefined`, not `[]` — a caller changing only a city must not wipe what the institute
      // declared, and the two are what tell the repository which was meant.
      expect(institutes.update).toHaveBeenCalledWith(
        'inst-1',
        { city: 'Karachi' },
        'actor-1',
        undefined,
      );
    });

    it('replaces the answers when a set is sent', async () => {
      const { service, institutes } = build();
      await service.updateInstitute('inst-1', { answers: [VALID_ANSWER] }, 'actor-1');

      expect(institutes.update).toHaveBeenCalledWith('inst-1', {}, 'actor-1', [VALID_ANSWER]);
    });

    /**
     * The category is absent from the update schema, so the questions being answered are the
     * institute's stored ones. Validating against a category named in the request would let an
     * edit smuggle in answers to questions this institute was never asked.
     */
    it('checks the answers against the stored category, not one from the request', async () => {
      const { service, categories } = build();
      await service.updateInstitute('inst-1', { answers: [VALID_ANSWER] }, 'actor-1');

      expect(categories.findById).toHaveBeenCalledWith(CATEGORY.id);
    });

    it('refuses an answer the category does not accept', async () => {
      const { service, institutes } = build();

      await expect(service.updateInstitute('inst-1', { answers: [] }, 'actor-1')).rejects.toThrow(
        /must be answered/i,
      );
      expect(institutes.update).not.toHaveBeenCalled();
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
