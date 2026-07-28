import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';

import type { SafeUser } from '@oses/types';

import { AUTH_CONFIG, type AuthConfig } from '../../config/auth.config';
import { legacyRoleFor } from '../../rbac/legacy-role';
import {
  AUTH_AUDIT_REPOSITORY,
  type AuthAuditRepository,
  SESSION_REPOSITORY,
  type SessionRepository,
  USER_REPOSITORY,
  type UserRepository,
} from '../ports';
import { toSafeUser } from '../user-mapper';
import type { LoginContext } from './auth.service';
import { TokenService } from './token.service';

export interface RefreshResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly audit: AuthAuditRepository,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Rotate a refresh token: validate the presented token, issue a fresh access +
   * refresh pair, and retire the old one. If a retired or revoked token is replayed,
   * that's a theft signal — the whole family is revoked and the caller is rejected.
   */
  async refresh(refreshToken: string, ctx: LoginContext): Promise<RefreshResult> {
    const invalid = new UnauthorizedException('Invalid session');
    const session = await this.sessions.findByRefreshHash(
      this.tokens.hashRefreshToken(refreshToken),
    );

    if (!session) {
      await this.audit.record({ event: 'refresh.invalid', ip: ctx.ip, userAgent: ctx.userAgent });
      throw invalid;
    }

    if (session.revokedAt || session.rotatedAt) {
      await this.sessions.revokeFamily(session.familyId, 'reuse_detected');
      // Token theft: an independent warn so it's visible even if the audit write below fails.
      this.logger.warn(
        `Refresh-token reuse detected for user ${session.userId}; revoked family ${session.familyId} (ip=${ctx.ip ?? 'unknown'}).`,
      );
      await this.audit.record({
        event: 'refresh.reuse',
        userId: session.userId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw invalid;
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await this.sessions.revokeById(session.id, 'expired');
      await this.audit.record({
        event: 'refresh.expired',
        userId: session.userId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw invalid;
    }

    const user = await this.users.findById(session.userId);
    if (!user || user.status !== 'active') {
      await this.sessions.revokeById(session.id, 'inactive');
      throw invalid;
    }

    const { token: newRefresh, hash } = this.tokens.generateRefreshToken();
    const newId = await this.sessions.create({
      userId: user.id,
      refreshHash: hash,
      familyId: session.familyId, // stay in the same rotation chain
      expiresAt: new Date(Date.now() + this.config.refreshTtlMs),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    await this.sessions.markRotated(session.id, newId);

    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      role: legacyRoleFor(user.roleId),
      roleId: user.roleId,
      instituteId: user.instituteId ?? undefined,
    });
    await this.audit.record({
      event: 'refresh.success',
      actorId: user.id,
      userId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { user: toSafeUser(user), accessToken, refreshToken: newRefresh };
  }

  /** Revoke the session behind a refresh token. Idempotent — a missing token is a no-op. */
  async logout(refreshToken: string | undefined, ctx: LoginContext): Promise<void> {
    if (!refreshToken) return;
    const session = await this.sessions.findByRefreshHash(
      this.tokens.hashRefreshToken(refreshToken),
    );
    if (!session) return;

    if (session.revokedAt) {
      // Replaying an already-revoked token at logout — benign double-logout or a theft
      // signal. Don't re-revoke, but leave an audit trail (the /refresh path treats the
      // same replay as reuse and revokes the family).
      await this.audit.record({
        event: 'logout',
        actorId: session.userId,
        userId: session.userId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { result: 'already_revoked' },
      });
      return;
    }

    await this.sessions.revokeById(session.id, 'logout');
    await this.audit.record({
      event: 'logout',
      actorId: session.userId,
      userId: session.userId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
}
