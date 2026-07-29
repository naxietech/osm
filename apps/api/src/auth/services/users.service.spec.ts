import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

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
    roleId: 'role_admin',
    instituteId: null,
    fullName: 'Staff Member',
    status: 'active',
    mfaEnabled: false,
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
    roleId: 'role_admin',
    password: 'temp-pass-123',
  };

  describe('listUsers', () => {
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
        service.createUser({ ...dto, roleId: 'role_wizard' }, 'admin'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate email', async () => {
      users.findByEmail.mockResolvedValue(makeUser());
      await expect(service.createUser(dto, 'admin')).rejects.toBeInstanceOf(ConflictException);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('creates the user (hashed password) and audits', async () => {
      users.findByEmail.mockResolvedValue(null);
      const result = await service.createUser(dto, 'admin');
      expect(mockHash).toHaveBeenCalledWith('temp-pass-123');
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'staff@oses.pk',
          roleId: 'role_admin',
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
    it('suspend revokes all sessions', async () => {
      users.findById.mockResolvedValue(makeUser());
      await service.setStatus('u-new', { status: 'suspended' }, 'admin');
      expect(users.updateStatus).toHaveBeenCalledWith('u-new', 'suspended');
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u-new', 'suspended');
    });

    it('reactivate does not revoke sessions but clears any lockout (#9)', async () => {
      users.findById.mockResolvedValue(makeUser({ status: 'suspended' }));
      await service.setStatus('u-new', { status: 'active' }, 'admin');
      expect(users.updateStatus).toHaveBeenCalledWith('u-new', 'active');
      expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
      expect(users.clearLockout).toHaveBeenCalledWith('u-new');
    });

    it('blocks suspending your own account (#6)', async () => {
      users.findById.mockResolvedValue(makeUser({ id: 'me' }));
      await expect(service.setStatus('me', { status: 'suspended' }, 'me')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(users.updateStatus).not.toHaveBeenCalled();
    });

    it('blocks suspending the last active Super Admin (#6)', async () => {
      users.findById.mockResolvedValue(
        makeUser({ id: 'sa', roleId: 'role_super_admin', status: 'active' }),
      );
      users.countActiveByRole.mockResolvedValue(1);
      await expect(
        service.setStatus('sa', { status: 'suspended' }, 'admin'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users.updateStatus).not.toHaveBeenCalled();
    });

    it('allows suspending a Super Admin when others remain active (#6)', async () => {
      users.findById.mockResolvedValue(
        makeUser({ id: 'sa', roleId: 'role_super_admin', status: 'active' }),
      );
      users.countActiveByRole.mockResolvedValue(2);
      await service.setStatus('sa', { status: 'suspended' }, 'admin');
      expect(users.updateStatus).toHaveBeenCalledWith('sa', 'suspended');
    });
  });
});
