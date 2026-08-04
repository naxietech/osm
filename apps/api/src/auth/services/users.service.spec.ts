import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { SYSTEM_ROLE_IDS } from '../../rbac/system-roles';
import { hashPassword } from '../../shared/crypto';
import {
  type AuthAuditRepository,
  type AuthUserRecord,
  EmailAlreadyExistsError,
  type SessionRepository,
  type UserRepository,
} from '../ports';
import { UsersService } from './users.service';

jest.mock('../../shared/crypto', () => ({
  hashPassword: jest.fn().mockResolvedValue('$argon2id$hash'),
}));
const mockHash = hashPassword as jest.MockedFunction<typeof hashPassword>;

function makeUser(over: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return {
    id: 'u-new',
    email: 'staff@oses.pk',
    passwordHash: '$argon2id$hash',
    roleId: SYSTEM_ROLE_IDS.admin,
    instituteId: null,
    fullName: 'Staff Member',
    status: 'active',
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

describe('UsersService', () => {
  let users: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    list: jest.Mock;
    count: jest.Mock;
    countActiveByRole: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updatePassword: jest.Mock;
    updateStatus: jest.Mock;
    clearLockout: jest.Mock;
  };
  let sessions: { revokeAllForUser: jest.Mock };
  let audit: { record: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      list: jest.fn(),
      count: jest.fn(),
      countActiveByRole: jest.fn().mockResolvedValue(2),
      create: jest.fn().mockResolvedValue(makeUser()),
      update: jest.fn().mockResolvedValue(makeUser()),
      updatePassword: jest.fn(),
      updateStatus: jest.fn(),
      clearLockout: jest.fn(),
    };
    sessions = { revokeAllForUser: jest.fn() };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    mockHash.mockClear();
    service = new UsersService(
      users as unknown as UserRepository,
      sessions as unknown as SessionRepository,
      audit as unknown as AuthAuditRepository,
    );
  });

  const dto = {
    email: 'staff@oses.pk',
    fullName: 'Staff Member',
    roleId: SYSTEM_ROLE_IDS.admin,
    password: 'temp-pass-123',
  };

  describe('listUsers', () => {
    it('passes every filter to BOTH the page and the count', async () => {
      users.list.mockResolvedValue([]);
      users.count.mockResolvedValue(0);
      await service.listUsers({
        limit: 20,
        offset: 40,
        q: 'ali',
        status: 'deactivate',
        roleId: SYSTEM_ROLE_IDS.checker,
      });
      const filters = { search: 'ali', status: 'deactivate', roleId: SYSTEM_ROLE_IDS.checker };
      expect(users.list).toHaveBeenCalledWith({ ...filters, limit: 20, offset: 40 });
      // If the count were unfiltered, a 4-result search would report "4 of 300".
      expect(users.count).toHaveBeenCalledWith(filters);
    });

    it('leaves absent filters undefined rather than inventing defaults', async () => {
      users.list.mockResolvedValue([]);
      users.count.mockResolvedValue(0);
      await service.listUsers({ limit: 50, offset: 0 });
      expect(users.count).toHaveBeenCalledWith({
        search: undefined,
        status: undefined,
        roleId: undefined,
      });
    });

    it('returns mapped SafeUsers + total, never leaking password_hash', async () => {
      users.list.mockResolvedValue([makeUser(), makeUser({ id: 'u2', email: 'b@oses.pk' })]);
      users.count.mockResolvedValue(2);
      const res = await service.listUsers({ limit: 50, offset: 0 });
      expect(res.total).toBe(2);
      expect(res.items).toHaveLength(2);
      const [first] = res.items;
      expect(first?.email).toBe('staff@oses.pk');
      expect(first?.status).toBe('active');
      expect(first).toHaveProperty('lastLoginAt');
      expect(first).not.toHaveProperty('passwordHash');
    });
  });

  describe('createUser', () => {
    it('rejects an unknown role', async () => {
      await expect(
        service.createUser({ ...dto, roleId: 'not-a-real-role-id' }, 'admin'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate email', async () => {
      users.findByEmail.mockResolvedValue(makeUser());
      await expect(service.createUser(dto, 'admin')).rejects.toBeInstanceOf(ConflictException);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('refuses to tie a global role to an institute', async () => {
      // assertOwnInstitute treats anyone carrying an instituteId as institute-bound, so
      // storing this would silently lock a Super Admin out of every other institute —
      // with no screen to undo it.
      for (const roleId of ['role_super_admin', 'role_admin', 'role_controller']) {
        await expect(
          service.createUser({ ...dto, roleId, instituteId: 'sch_001' }, 'admin'),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(users.create).not.toHaveBeenCalled();
    });

    it('accepts an institute for the roles that take one', async () => {
      // Institute needs one (all its grants are own-institute); an Evaluator may have one,
      // which makes them a school-specific checker rather than a general one.
      for (const roleId of ['role_institute', 'role_checker']) {
        users.findByEmail.mockResolvedValue(undefined);
        await expect(
          service.createUser({ ...dto, roleId, instituteId: 'sch_001' }, 'admin'),
        ).resolves.toBeDefined();
      }
    });

    it('accepts a global role with no institute', async () => {
      users.findByEmail.mockResolvedValue(undefined);
      await expect(
        service.createUser({ ...dto, roleId: 'role_super_admin' }, 'admin'),
      ).resolves.toBeDefined();
    });

    it('creates the user (hashed password) and audits', async () => {
      users.findByEmail.mockResolvedValue(null);
      const result = await service.createUser(dto, 'admin');
      expect(mockHash).toHaveBeenCalledWith('temp-pass-123');
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'staff@oses.pk',
          roleId: SYSTEM_ROLE_IDS.admin,
          createdBy: 'admin',
        }),
      );
      expect(result.email).toBe('staff@oses.pk');
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'user.created' }));
    });

    it('translates a create-time duplicate (concurrent race) into a 409, not a 500 (#1)', async () => {
      users.findByEmail.mockResolvedValue(null); // passes the pre-check
      users.create.mockRejectedValue(new EmailAlreadyExistsError());
      await expect(service.createUser(dto, 'admin')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('resetPassword', () => {
    it('404s an unknown user', async () => {
      users.findById.mockResolvedValue(null);
      await expect(
        service.resetPassword('nope', { password: 'new-pass-123' }, 'admin'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates the password and revokes all the user sessions', async () => {
      users.findById.mockResolvedValue(makeUser());
      await service.resetPassword('u-new', { password: 'new-pass-123' }, 'admin');
      expect(users.updatePassword).toHaveBeenCalledWith('u-new', '$argon2id$hash');
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u-new', 'admin_reset');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'password.reset' }),
      );
    });
  });

  describe('setStatus', () => {
    it('deactivate revokes all sessions', async () => {
      users.findById.mockResolvedValue(makeUser());
      await service.setStatus('u-new', { status: 'deactivate' }, 'admin');
      expect(users.updateStatus).toHaveBeenCalledWith('u-new', 'deactivate');
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u-new', 'deactivate');
    });

    it('reactivate does not revoke sessions but clears any lockout (#9)', async () => {
      users.findById.mockResolvedValue(makeUser({ status: 'deactivate' }));
      await service.setStatus('u-new', { status: 'active' }, 'admin');
      expect(users.updateStatus).toHaveBeenCalledWith('u-new', 'active');
      expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
      expect(users.clearLockout).toHaveBeenCalledWith('u-new');
    });

    it('blocks deactivating your own account (#6)', async () => {
      users.findById.mockResolvedValue(makeUser({ id: 'me' }));
      await expect(service.setStatus('me', { status: 'deactivate' }, 'me')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(users.updateStatus).not.toHaveBeenCalled();
    });

    it('blocks deactivating the last active Super Admin (#6)', async () => {
      users.findById.mockResolvedValue(
        makeUser({ id: 'sa', roleId: SYSTEM_ROLE_IDS.superAdmin, status: 'active' }),
      );
      users.countActiveByRole.mockResolvedValue(1);
      await expect(
        service.setStatus('sa', { status: 'deactivate' }, 'admin'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users.updateStatus).not.toHaveBeenCalled();
    });

    it('allows deactivating a Super Admin when others remain active (#6)', async () => {
      users.findById.mockResolvedValue(
        makeUser({ id: 'sa', roleId: SYSTEM_ROLE_IDS.superAdmin, status: 'active' }),
      );
      users.countActiveByRole.mockResolvedValue(2);
      await service.setStatus('sa', { status: 'deactivate' }, 'admin');
      expect(users.updateStatus).toHaveBeenCalledWith('sa', 'deactivate');
    });
  });

  /**
   * Only an Institute account may carry an institute id, and it must carry one. Nothing in the
   * schema enforces that, so every path that can set either half is covered here.
   */
  describe('role / institute pairing', () => {
    const institute = SYSTEM_ROLE_IDS.institute;
    const evaluator = SYSTEM_ROLE_IDS.checker;

    describe('createUser', () => {
      beforeEach(() => users.findByEmail.mockResolvedValue(null));

      it('rejects an Institute account with no institute', async () => {
        await expect(service.createUser({ ...dto, roleId: institute }, 'admin')).rejects.toThrow(
          'An Institute account must be linked to an institute.',
        );
        expect(users.create).not.toHaveBeenCalled();
      });

      it('rejects an institute id on a role that cannot have one', async () => {
        await expect(
          service.createUser({ ...dto, roleId: evaluator, instituteId: 'inst-A' }, 'admin'),
        ).rejects.toThrow('Only an Institute account can be linked to an institute.');
        expect(users.create).not.toHaveBeenCalled();
      });

      it('creates an Institute account with its institute', async () => {
        await service.createUser({ ...dto, roleId: institute, instituteId: 'inst-A' }, 'admin');
        expect(users.create).toHaveBeenCalledWith(
          expect.objectContaining({ roleId: institute, instituteId: 'inst-A' }),
        );
      });

      it('stores null rather than undefined when the role takes no institute', async () => {
        await service.createUser(dto, 'admin');
        expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ instituteId: null }));
      });
    });

    describe('updateUser', () => {
      it('clears the institute when the account moves off the Institute role', async () => {
        users.findById.mockResolvedValue(makeUser({ roleId: institute, instituteId: 'inst-A' }));
        await service.updateUser('u-new', { roleId: evaluator }, 'admin');
        expect(users.update).toHaveBeenCalledWith('u-new', {
          roleId: evaluator,
          instituteId: null,
        });
      });

      it('records the forced clearing in the audit entry — the caller never asked for it', async () => {
        users.findById.mockResolvedValue(makeUser({ roleId: institute, instituteId: 'inst-A' }));
        await service.updateUser('u-new', { roleId: evaluator }, 'admin');
        expect(audit.record).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({ instituteCleared: 'inst-A' }),
          }),
        );
      });

      it('refuses to move onto the Institute role without an institute', async () => {
        users.findById.mockResolvedValue(makeUser({ roleId: evaluator }));
        await expect(service.updateUser('u-new', { roleId: institute }, 'admin')).rejects.toThrow(
          'An Institute account must be linked to an institute.',
        );
        expect(users.update).not.toHaveBeenCalled();
      });

      it('allows moving onto the Institute role when the institute comes with it', async () => {
        users.findById.mockResolvedValue(makeUser({ roleId: evaluator }));
        await service.updateUser('u-new', { roleId: institute, instituteId: 'inst-A' }, 'admin');
        expect(users.update).toHaveBeenCalledWith('u-new', {
          roleId: institute,
          instituteId: 'inst-A',
        });
      });

      it('rejects attaching an institute to a non-Institute account', async () => {
        users.findById.mockResolvedValue(makeUser({ roleId: evaluator }));
        await expect(
          service.updateUser('u-new', { instituteId: 'inst-A' }, 'admin'),
        ).rejects.toThrow('Only an Institute account can be linked to an institute.');
        expect(users.update).not.toHaveBeenCalled();
      });

      it('refuses to unlink an account that stays on the Institute role', async () => {
        users.findById.mockResolvedValue(makeUser({ roleId: institute, instituteId: 'inst-A' }));
        await expect(service.updateUser('u-new', { instituteId: null }, 'admin')).rejects.toThrow(
          'An Institute account must be linked to an institute.',
        );
        expect(users.update).not.toHaveBeenCalled();
      });

      it('leaves the institute alone on an edit that does not touch the pairing', async () => {
        users.findById.mockResolvedValue(makeUser({ roleId: institute, instituteId: 'inst-A' }));
        await service.updateUser('u-new', { fullName: 'New Name' }, 'admin');
        expect(users.update).toHaveBeenCalledWith('u-new', { fullName: 'New Name' });
      });
    });
  });
});
