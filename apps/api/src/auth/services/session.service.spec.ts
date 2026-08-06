import { UnauthorizedException } from '@nestjs/common';

import type { AuthConfig } from '../../config/auth.config';
import { SYSTEM_ROLE_IDS } from '../../rbac/system-roles';
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
    roleId: SYSTEM_ROLE_IDS.superAdmin,
    instituteId: null,
    fullName: 'Admin',
    status: 'active',
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
    rotateSession: jest.Mock;
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
      rotateSession: jest.fn().mockResolvedValue(true),
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
    expect(sessions.rotateSession).not.toHaveBeenCalled();
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

    expect(sessions.rotateSession).toHaveBeenCalledWith(
      's1',
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
    // The atomic rotate lost the race — another request already rotated this token, so it
    // minted nothing and returned false.
    sessions.findByRefreshHash.mockResolvedValue(makeSession());
    users.findById.mockResolvedValue(makeUser());
    sessions.rotateSession.mockResolvedValue(false);

    await expect(service.refresh('tok', ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'refresh.reuse' }));
  });

  it('propagates a rotation DB failure without a false-theft family revoke (#2)', async () => {
    // If the atomic rotate throws (transient DB error), the request fails but must NOT revoke
    // the family — the transaction rollback keeps the old token usable for a clean retry.
    sessions.findByRefreshHash.mockResolvedValue(makeSession());
    users.findById.mockResolvedValue(makeUser());
    sessions.rotateSession.mockRejectedValue(new Error('db down'));

    await expect(service.refresh('tok', ctx)).rejects.toThrow('db down');
    expect(sessions.revokeFamily).not.toHaveBeenCalled();
  });

  it('logout revokes the whole family behind the token', async () => {
    sessions.findByRefreshHash.mockResolvedValue(makeSession());
    await service.logout('tok', ctx);
    expect(sessions.revokeFamily).toHaveBeenCalledWith('fam1', 'logout');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'logout' }));
  });

  it('logout with a just-rotated token (within grace) still revokes the live family (#3)', async () => {
    // Background refresh rotated the token moments before logout — still honour it so the
    // live successor is killed. revoke by family, not by the single (dead) row.
    sessions.findByRefreshHash.mockResolvedValue(makeSession({ rotatedAt: new Date() }));
    await service.logout('tok', ctx);
    expect(sessions.revokeFamily).toHaveBeenCalledWith('fam1', 'logout');
  });

  it('logout with a stale (long-rotated) token is a no-op — closes the DoS (#1)', async () => {
    // A captured, long-dead token must not be replayable to force-revoke a live session.
    sessions.findByRefreshHash.mockResolvedValue(
      makeSession({ rotatedAt: new Date(Date.now() - 120_000) }),
    );
    await service.logout('tok', ctx);
    expect(sessions.revokeFamily).not.toHaveBeenCalled();
  });

  it('logout with an already-revoked token is a no-op', async () => {
    sessions.findByRefreshHash.mockResolvedValue(makeSession({ revokedAt: new Date() }));
    await service.logout('tok', ctx);
    expect(sessions.revokeFamily).not.toHaveBeenCalled();
  });

  it('logout with an expired token is a no-op', async () => {
    sessions.findByRefreshHash.mockResolvedValue(
      makeSession({ expiresAt: new Date(Date.now() - 1000) }),
    );
    await service.logout('tok', ctx);
    expect(sessions.revokeFamily).not.toHaveBeenCalled();
  });

  it('logout with no token is a no-op', async () => {
    await service.logout(undefined, ctx);
    expect(sessions.findByRefreshHash).not.toHaveBeenCalled();
    expect(sessions.revokeFamily).not.toHaveBeenCalled();
  });
});
