import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { hashPassword } from '../../shared/crypto';
import type {
  AuthAuditRepository,
  AuthUserRecord,
  SessionRepository,
  UserRepository,
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
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

describe('UsersService', () => {
  let users: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    updatePassword: jest.Mock;
    updateStatus: jest.Mock;
  };
  let sessions: { revokeAllForUser: jest.Mock };
  let audit: { record: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn().mockResolvedValue(makeUser()),
      updatePassword: jest.fn(),
      updateStatus: jest.fn(),
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

    it('reactivate does not revoke sessions', async () => {
      users.findById.mockResolvedValue(makeUser({ status: 'suspended' }));
      await service.setStatus('u-new', { status: 'active' }, 'admin');
      expect(users.updateStatus).toHaveBeenCalledWith('u-new', 'active');
      expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    });
  });
});
