import { UnauthorizedException } from '@nestjs/common';

import type { AuthConfig } from '../../config/auth.config';
import type {
  AuthAuditRepository,
  AuthUserRecord,
  SessionRecord,
  SessionRepository,
  UserRepository,
} from '../ports';
import { SessionService } from './session.service';
import type { TokenService } from './token.service';

const config = {
  refreshTtlMs: 604_800_000,
  accessTtl: '15m',
} as AuthConfig;

const ctx = { ip: '203.0.113.5', userAgent: 'jest' };

function makeSession(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 's1',
    userId: 'u1',
    familyId: 'fam1',
    expiresAt: new Date(Date.now() + 100_000),
    rotatedAt: null,
    revokedAt: null,
    ...over,
  };
}

function makeUser(over: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return {
    id: 'u1',
    email: 'admin@oses.pk',
    passwordHash: 'x',
    roleId: 'role_super_admin',
    instituteId: null,
    fullName: 'Admin',
    status: 'active',
    mfaEnabled: false,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

describe('SessionService', () => {
  let users: { findById: jest.Mock };
  let sessions: {
    findByRefreshHash: jest.Mock;
    create: jest.Mock;
    markRotatedIfCurrent: jest.Mock;
    revokeFamily: jest.Mock;
    revokeById: jest.Mock;
  };
  let audit: { record: jest.Mock };
  let tokens: {
    hashRefreshToken: jest.Mock;
    generateRefreshToken: jest.Mock;
    signAccessToken: jest.Mock;
  };
  let service: SessionService;

  beforeEach(() => {
    users = { findById: jest.fn() };
    sessions = {
      findByRefreshHash: jest.fn(),
      create: jest.fn().mockResolvedValue('new-session'),
      markRotatedIfCurrent: jest.fn().mockResolvedValue(true),
      revokeFamily: jest.fn(),
      revokeById: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    tokens = {
      hashRefreshToken: jest.fn().mockReturnValue('hash'),
      generateRefreshToken: jest.fn().mockReturnValue({ token: 'new-refresh', hash: 'new-hash' }),
      signAccessToken: jest.fn().mockReturnValue('new-access'),
    };
    service = new SessionService(
      users as unknown as UserRepository,
      sessions as unknown as SessionRepository,
      audit as unknown as AuthAuditRepository,
      config,
      tokens as unknown as TokenService,
    );
  });

  it('rejects an unknown refresh token', async () => {
    sessions.findByRefreshHash.mockResolvedValue(null);
    await expect(service.refresh('tok', ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'refresh.invalid' }),
    );
  });

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    sessions.findByRefreshHash.mockResolvedValue(makeSession({ rotatedAt: new Date() }));
    await expect(service.refresh('tok', ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.revokeFamily).toHaveBeenCalledWith('fam1', 'reuse_detected');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'refresh.reuse' }));
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('rejects an expired session', async () => {
    sessions.findByRefreshHash.mockResolvedValue(
      makeSession({ expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(service.refresh('tok', ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.revokeById).toHaveBeenCalledWith('s1', 'expired');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'refresh.expired' }),
    );
  });

  it('rotates a valid token: new session in the same family, retires the old one, issues tokens', async () => {
    sessions.findByRefreshHash.mockResolvedValue(makeSession());
    users.findById.mockResolvedValue(makeUser());

    const result = await service.refresh('tok', ctx);

    expect(sessions.markRotatedIfCurrent).toHaveBeenCalledWith('s1');
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: 'fam1', refreshHash: 'new-hash' }),
    );
    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(result.user.id).toBe('u1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'refresh.success' }),
    );
  });

  it('rejects a lost rotation race (concurrent refresh) without minting a session', async () => {
    // The atomic claim lost the race — another request already rotated this token.
    sessions.findByRefreshHash.mockResolvedValue(makeSession());
    users.findById.mockResolvedValue(makeUser());
    sessions.markRotatedIfCurrent.mockResolvedValue(false);

    await expect(service.refresh('tok', ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.create).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'refresh.reuse' }));
  });

  it('logout revokes the whole family behind the token', async () => {
    sessions.findByRefreshHash.mockResolvedValue(makeSession());
    await service.logout('tok', ctx);
    expect(sessions.revokeFamily).toHaveBeenCalledWith('fam1', 'logout');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'logout' }));
  });

  it('logout with an already-rotated token still revokes the live family (#3)', async () => {
    // If a background refresh rotated the token first, logging out with the OLD token must
    // still kill the live successor — so revoke by family, not by the single (dead) row.
    sessions.findByRefreshHash.mockResolvedValue(makeSession({ rotatedAt: new Date() }));
    await service.logout('tok', ctx);
    expect(sessions.revokeFamily).toHaveBeenCalledWith('fam1', 'logout');
  });

  it('logout with no token is a no-op', async () => {
    await service.logout(undefined, ctx);
    expect(sessions.findByRefreshHash).not.toHaveBeenCalled();
    expect(sessions.revokeFamily).not.toHaveBeenCalled();
  });
});
