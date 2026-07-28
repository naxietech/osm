import { BadRequestException, UnauthorizedException } from '@nestjs/common';

import type { AuthConfig } from '../../config/auth.config';
import { hashPassword, verifyPassword } from '../../shared/crypto';
import type {
  AuthAuditRepository,
  AuthUserRecord,
  SessionRepository,
  UserRepository,
} from '../ports';
import { AuthService } from './auth.service';
import type { TokenService } from './token.service';

jest.mock('../../shared/crypto', () => ({
  verifyPassword: jest.fn(),
  hashPassword: jest.fn().mockResolvedValue('$argon2id$new'),
}));
const mockVerify = verifyPassword as jest.MockedFunction<typeof verifyPassword>;
const mockHash = hashPassword as jest.MockedFunction<typeof hashPassword>;

const config: AuthConfig = {
  accessTtl: '15m',
  accessCookieMaxAgeMs: 900_000,
  refreshTtlMs: 604_800_000,
  lockout: { maxAttempts: 5, lockMs: 900_000 },
  cookie: { secure: false, sameSite: 'lax' },
  accessCookieName: 'a',
  refreshCookieName: 'r',
};

function makeUser(over: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return {
    id: 'u1',
    email: 'admin@oses.pk',
    passwordHash: '$argon2id$fake',
    roleId: 'role_super_admin',
    instituteId: null,
    fullName: 'System Administrator',
    status: 'active',
    mfaEnabled: false,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

describe('AuthService.login', () => {
  const ctx = { ip: '203.0.113.5', userAgent: 'jest' };
  let users: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    updatePassword: jest.Mock;
    incrementFailedLogin: jest.Mock;
    applyLockout: jest.Mock;
    markLoginSuccess: jest.Mock;
  };
  let sessions: { create: jest.Mock; revokeAllForUser: jest.Mock };
  let audit: { record: jest.Mock };
  let tokens: { generateRefreshToken: jest.Mock; signAccessToken: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updatePassword: jest.fn(),
      incrementFailedLogin: jest.fn(),
      applyLockout: jest.fn(),
      markLoginSuccess: jest.fn(),
    };
    sessions = { create: jest.fn().mockResolvedValue('sess1'), revokeAllForUser: jest.fn() };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    tokens = {
      generateRefreshToken: jest
        .fn()
        .mockReturnValue({ token: 'refresh-tok', hash: 'refresh-hash' }),
      signAccessToken: jest.fn().mockReturnValue('access-tok'),
    };
    mockVerify.mockReset();
    service = new AuthService(
      users as unknown as UserRepository,
      sessions as unknown as SessionRepository,
      audit as unknown as AuthAuditRepository,
      config,
      tokens as unknown as TokenService,
    );
  });

  it('rejects an unknown account and audits the failure', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(
      service.login({ email: 'x@y.com', password: 'whatever' }, ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'login.failure' }));
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('rejects a temporarily locked account without checking the password', async () => {
    users.findByEmail.mockResolvedValue(makeUser({ lockedUntil: new Date(Date.now() + 60_000) }));
    await expect(
      service.login({ email: 'admin@oses.pk', password: 'x' }, ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'login.locked' }));
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('rejects a non-active account', async () => {
    users.findByEmail.mockResolvedValue(makeUser({ status: 'suspended' }));
    await expect(
      service.login({ email: 'admin@oses.pk', password: 'x' }, ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'login.inactive' }));
  });

  it('on wrong password: increments the counter, does not lock before the threshold', async () => {
    users.findByEmail.mockResolvedValue(makeUser());
    mockVerify.mockResolvedValue(false);
    users.incrementFailedLogin.mockResolvedValue(3);
    await expect(
      service.login({ email: 'admin@oses.pk', password: 'nope' }, ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.incrementFailedLogin).toHaveBeenCalledWith('u1');
    expect(users.applyLockout).not.toHaveBeenCalled();
  });

  it('locks the account once the attempt threshold is reached', async () => {
    users.findByEmail.mockResolvedValue(makeUser());
    mockVerify.mockResolvedValue(false);
    users.incrementFailedLogin.mockResolvedValue(5);
    await expect(
      service.login({ email: 'admin@oses.pk', password: 'nope' }, ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.applyLockout).toHaveBeenCalledWith('u1', expect.any(Date));
  });

  it('on success: opens a session, issues tokens, resets the counter, audits', async () => {
    users.findByEmail.mockResolvedValue(makeUser());
    mockVerify.mockResolvedValue(true);
    const result = await service.login({ email: 'admin@oses.pk', password: 'right' }, ctx);

    expect(users.markLoginSuccess).toHaveBeenCalledWith('u1');
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', refreshHash: 'refresh-hash' }),
    );
    expect(result.accessToken).toBe('access-tok');
    expect(result.refreshToken).toBe('refresh-tok');
    expect(result.user.email).toBe('admin@oses.pk');
    expect(result.user.roleId).toBe('role_super_admin');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'login.success' }));
  });

  describe('changePassword', () => {
    it('rejects a wrong current password', async () => {
      users.findById.mockResolvedValue(makeUser());
      mockVerify.mockResolvedValue(false);
      await expect(
        service.changePassword('u1', { currentPassword: 'nope', newPassword: 'new-pass-123' }, ctx),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users.updatePassword).not.toHaveBeenCalled();
    });

    it('on success: updates the hash and revokes every session', async () => {
      users.findById.mockResolvedValue(makeUser());
      mockVerify.mockResolvedValue(true);
      await service.changePassword(
        'u1',
        { currentPassword: 'right', newPassword: 'new-pass-123' },
        ctx,
      );
      expect(mockHash).toHaveBeenCalledWith('new-pass-123');
      expect(users.updatePassword).toHaveBeenCalledWith('u1', '$argon2id$new');
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u1', 'password_change');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'password.change' }),
      );
    });
  });
});
