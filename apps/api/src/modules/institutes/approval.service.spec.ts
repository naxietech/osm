import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { InstitutionType, Province } from '@oses/types';

import type { AuthAuditRepository } from '../../auth/ports';
import { SYSTEM_ROLE_IDS } from '../../rbac/system-roles';
import { ApprovalService } from './approval.service';
import type {
  AccountLookup,
  ApproveOutcome,
  InstituteApprovalRepository,
  InstituteCredentialRepository,
  InstituteDependants,
  InstituteRecord,
  InstituteRepository,
  RejectOutcome,
} from './ports';

function record(over: Partial<InstituteRecord> = {}): InstituteRecord {
  return {
    id: 'inst-1',
    instituteCode: 'S01',
    numericCode: null,
    instituteName: 'Government High School',
    branch: null,
    categoryId: 'cat-1',
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
    answers: [],
    ...over,
  };
}

interface Harness {
  service: ApprovalService;
  audit: jest.Mocked<AuthAuditRepository>;
  institutes: jest.Mocked<InstituteRepository>;
  approvals: jest.Mocked<InstituteApprovalRepository>;
  credentials: jest.Mocked<InstituteCredentialRepository>;
  accounts: jest.Mocked<AccountLookup>;
  dependants: jest.Mocked<InstituteDependants>;
  /** The order dependant methods were called in — the point of the deactivation test. */
  cascadeOrder: string[];
}

function build(
  over: {
    institute?: InstituteRecord | null;
    approveOutcome?: ApproveOutcome;
    rejectOutcome?: RejectOutcome;
    storedHash?: string | null;
  } = {},
): Harness {
  const current = over.institute === undefined ? record() : over.institute;
  const cascadeOrder: string[] = [];

  const institutes = {
    findById: jest.fn().mockResolvedValue(current),
  } as unknown as jest.Mocked<InstituteRepository>;

  const approvals = {
    approve: jest.fn().mockResolvedValue(
      over.approveOutcome ?? {
        outcome: 'approved',
        institute: record({ status: 'approved', numericCode: 1 }),
        userId: 'user-1',
      },
    ),
    reject: jest.fn().mockResolvedValue(
      over.rejectOutcome ?? {
        outcome: 'rejected',
        institute: record({ status: 'rejected', rejectionReason: 'Not verifiable' }),
      },
    ),
    setStatus: jest.fn().mockResolvedValue(record({ status: 'deactivated', numericCode: 1 })),
  } as unknown as jest.Mocked<InstituteApprovalRepository>;

  const credentials = {
    find: jest
      .fn()
      .mockResolvedValue(over.storedHash === undefined ? '$argon2id$stored' : over.storedHash),
    remove: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<InstituteCredentialRepository>;

  const accounts = {
    isEmailTaken: jest.fn().mockResolvedValue(false),
  } as unknown as jest.Mocked<AccountLookup>;

  const track = (name: string, result: unknown) =>
    jest.fn().mockImplementation(() => {
      cascadeOrder.push(name);
      return Promise.resolve(result);
    });

  const dependants = {
    count: jest.fn().mockResolvedValue({ users: 0, students: 0, exams: 0 }),
    releaseAllocations: track('releaseAllocations', 0),
    deactivateEvaluators: track('deactivateEvaluators', 0),
    deactivateStudents: track('deactivateStudents', 0),
    deactivateUsers: track('deactivateUsers', 2),
  } as unknown as jest.Mocked<InstituteDependants>;

  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuthAuditRepository>;

  return {
    service: new ApprovalService(institutes, approvals, credentials, accounts, dependants, audit),
    audit,
    institutes,
    approvals,
    credentials,
    accounts,
    dependants,
    cascadeOrder,
  };
}

describe('ApprovalService', () => {
  describe('approve', () => {
    it('creates the login from the stored credential', async () => {
      const { service, approvals } = build();
      const result = await service.approve('inst-1', { createLogin: true }, 'admin-1');

      expect(approvals.approve).toHaveBeenCalledWith({
        instituteId: 'inst-1',
        approvedBy: 'admin-1',
        login: {
          email: 'principal@example.pk',
          fullName: 'Ayesha Khan',
          passwordHash: '$argon2id$stored',
          roleId: SYSTEM_ROLE_IDS.institute,
        },
      });
      expect(result.userId).toBe('user-1');
    });

    it('names the contact person as the account holder unless told otherwise', async () => {
      const { service, approvals } = build();
      await service.approve('inst-1', { createLogin: true, fullName: 'Someone Else' }, 'admin-1');

      expect(approvals.approve.mock.calls[0]![0].login?.fullName).toBe('Someone Else');
    });

    it('approves without a login when asked not to create one', async () => {
      const { service, approvals, credentials } = build({
        approveOutcome: {
          outcome: 'approved',
          institute: record({ status: 'approved' }),
          userId: null,
        },
      });
      const result = await service.approve('inst-1', { createLogin: false }, 'admin-1');

      expect(approvals.approve.mock.calls[0]![0].login).toBeNull();
      expect(credentials.find).not.toHaveBeenCalled();
      expect(result.message).toMatch(/no login was created/i);
    });

    it('hashes a supplied password rather than storing it', async () => {
      const { service, approvals } = build({ storedHash: null });
      await service.approve('inst-1', { createLogin: true, password: 'a-strong-password' }, 'a');

      const hash = approvals.approve.mock.calls[0]![0].login?.passwordHash;
      expect(hash).toEqual(expect.stringContaining('$argon2id$'));
      expect(hash).not.toContain('a-strong-password');
    });

    it('prefers a supplied password over the stored one', async () => {
      const { service, approvals } = build({ storedHash: '$argon2id$stored' });
      await service.approve('inst-1', { createLogin: true, password: 'a-strong-password' }, 'a');

      expect(approvals.approve.mock.calls[0]![0].login?.passwordHash).not.toBe('$argon2id$stored');
    });

    it('refuses rather than inventing a password nobody was told', async () => {
      const { service, approvals } = build({ storedHash: null });

      await expect(service.approve('inst-1', { createLogin: true }, 'a')).rejects.toThrow(
        BadRequestException,
      );
      expect(approvals.approve).not.toHaveBeenCalled();
    });

    it('refuses when the contact email already has an account', async () => {
      const { service, accounts, approvals } = build();
      accounts.isEmailTaken.mockResolvedValue(true);

      await expect(service.approve('inst-1', { createLogin: true }, 'a')).rejects.toThrow(
        ConflictException,
      );
      expect(approvals.approve).not.toHaveBeenCalled();
    });

    it('still refuses when the email is taken between the check and the transaction', async () => {
      // The pre-check exists for a readable message; the users unique index is the guarantee.
      const { service } = build({ approveOutcome: { outcome: 'email-taken' } });
      await expect(service.approve('inst-1', { createLogin: true }, 'a')).rejects.toThrow(
        /already has an account/i,
      );
    });

    it('409s rather than minting a second account when approved twice', async () => {
      const { service } = build({ approveOutcome: { outcome: 'not-pending' } });
      await expect(service.approve('inst-1', { createLogin: true }, 'a')).rejects.toThrow(
        ConflictException,
      );
    });

    it('409s up front for an institute that is already approved', async () => {
      const { service, approvals } = build({ institute: record({ status: 'approved' }) });

      await expect(service.approve('inst-1', { createLogin: true }, 'a')).rejects.toThrow(
        /no longer awaiting approval/i,
      );
      expect(approvals.approve).not.toHaveBeenCalled();
    });

    it('404s for an institute that does not exist', async () => {
      const { service } = build({ institute: null });
      await expect(service.approve('nope', { createLogin: true }, 'a')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('records the new account, the same way a hand-made one is recorded', async () => {
      const { service, audit } = build();
      await service.approve('inst-1', { createLogin: true }, 'admin-1');

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'user.created', actorId: 'admin-1', userId: 'user-1' }),
      );
    });

    it('records nothing when no account was created', async () => {
      const { service, audit } = build({
        approveOutcome: {
          outcome: 'approved',
          institute: record({ status: 'approved' }),
          userId: null,
        },
      });
      await service.approve('inst-1', { createLogin: false }, 'admin-1');

      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('records the reason and reports the code is free again', async () => {
      const { service, approvals } = build();
      const result = await service.reject('inst-1', { reason: 'Not verifiable' }, 'admin-1');

      expect(approvals.reject).toHaveBeenCalledWith({
        instituteId: 'inst-1',
        reason: 'Not verifiable',
        rejectedBy: 'admin-1',
      });
      expect(result.message).toMatch(/free to be registered again/i);
    });

    it('409s for an institute that is no longer pending', async () => {
      const { service } = build({ institute: record({ status: 'approved' }) });
      await expect(service.reject('inst-1', { reason: 'x' }, 'a')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('deactivate', () => {
    it('releases allocations before switching off the evaluators holding them', async () => {
      const { service, cascadeOrder } = build({ institute: record({ status: 'approved' }) });
      await service.setStatus('inst-1', { status: 'deactivated' }, 'admin-1');

      expect(cascadeOrder).toEqual([
        'releaseAllocations',
        'deactivateEvaluators',
        'deactivateStudents',
        'deactivateUsers',
      ]);
    });

    it('switches the dependants off before the institute itself', async () => {
      // The other order would leave an institute reading as deactivated while its staff could
      // still sign in. This order fails safe: an interrupted run is incomplete, never open.
      const order: string[] = [];
      const { service, approvals, dependants } = build({
        institute: record({ status: 'approved' }),
      });
      dependants.deactivateUsers.mockImplementation(() => {
        order.push('users');
        return Promise.resolve(1);
      });
      approvals.setStatus.mockImplementation(() => {
        order.push('institute');
        return Promise.resolve(record({ status: 'deactivated' }));
      });

      await service.setStatus('inst-1', { status: 'deactivated' }, 'admin-1');
      expect(order).toEqual(['users', 'institute']);
    });

    it('leaves the institute active when the cascade fails', async () => {
      const { service, approvals, dependants } = build({
        institute: record({ status: 'approved' }),
      });
      dependants.deactivateUsers.mockRejectedValue(new Error('database down'));

      await expect(service.setStatus('inst-1', { status: 'deactivated' }, 'a')).rejects.toThrow(
        'database down',
      );
      expect(approvals.setStatus).not.toHaveBeenCalled();
    });

    it('records the accounts it switched off', async () => {
      // The single-user path is audited; without this the bulk path would not be, and the bulk
      // one is the harder to reconstruct afterwards.
      const { service, audit } = build({ institute: record({ status: 'approved' }) });
      await service.setStatus('inst-1', { status: 'deactivated' }, 'admin-1');

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'account.status',
          actorId: 'admin-1',
          metadata: expect.objectContaining({ accounts: 2, status: 'deactivate' }),
        }),
      );
    });

    it('runs no cascade when reactivating', async () => {
      const { service, cascadeOrder } = build({ institute: record({ status: 'deactivated' }) });
      await service.setStatus('inst-1', { status: 'approved' }, 'admin-1');

      expect(cascadeOrder).toEqual([]);
    });

    it('says plainly that reactivating does not switch the accounts back on', async () => {
      // Deactivation is one action; undoing it is not, because an account may have been switched
      // off for its own reasons. Saying so avoids a silent half-restore.
      const { service, approvals } = build({ institute: record({ status: 'deactivated' }) });
      approvals.setStatus.mockResolvedValue(record({ status: 'approved', numericCode: 1 }));

      const result = await service.setStatus('inst-1', { status: 'approved' }, 'a');
      expect(result.message).toMatch(/switched back on individually/i);
    });

    it('refuses to deactivate an application that was never approved', async () => {
      const { service, dependants } = build({ institute: record({ status: 'pending' }) });

      await expect(service.setStatus('inst-1', { status: 'deactivated' }, 'a')).rejects.toThrow(
        BadRequestException,
      );
      expect(dependants.releaseAllocations).not.toHaveBeenCalled();
    });

    it('404s for an institute that does not exist', async () => {
      const { service } = build({ institute: null });
      await expect(service.setStatus('nope', { status: 'deactivated' }, 'a')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
