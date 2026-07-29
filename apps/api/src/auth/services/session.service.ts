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

/**
 * How long after rotation a retired refresh token may still be used to LOG OUT. Covers the
 * legit "a background refresh rotated the token moments before the user clicked logout" race,
 * without letting a long-dead/captured token be replayed to force-revoke a live session.
 */
const LOGOUT_ROTATION_GRACE_MS = 30_000;

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

    // Resolve the legacy role BEFORE any mutation — legacyRoleFor throws on an unmapped
    // roleId, and that must not fire after the token has been rotated (it would strand the
    // user with a burned old token and a committed-but-unreturned new one).
    const role = legacyRoleFor(user.roleId);
    const { token: newRefresh, hash } = this.tokens.generateRefreshToken();

    // Atomic claim + mint (one transaction). Only one concurrent caller wins; the rest lost
    // the race and are rejected without minting anything (closes the double-spend). A DB
    // failure rolls the claim back, so the old token stays usable and a retry is a normal
    // refresh, not a mis-detected theft. A later reuse of the rotated token is still caught
    // as theft by the rotated/revoked check above.
    const won = await this.sessions.rotateSession(session.id, {
      userId: user.id,
      refreshHash: hash,
      familyId: session.familyId, // stay in the same rotation chain
      expiresAt: new Date(Date.now() + this.config.refreshTtlMs),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    if (!won) {
      await this.audit.record({
        event: 'refresh.reuse',
        userId: session.userId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { reason: 'concurrent_rotation' },
      });
      throw invalid;
    }

    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      role,
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

    // Only a still-usable token may tear down the family. Otherwise a captured, long-dead
    // token (rotated away, expired, or already revoked) could be replayed forever to
    // force-revoke a victim's live session — an unauthenticated logout DoS. A just-rotated
    // token is still honoured within a short grace window (the background-refresh-races-logout
    // case). These are all no-ops, not errors — logout stays idempotent and quiet.
    if (session.revokedAt) return;
    if (session.expiresAt.getTime() < Date.now()) return;
    if (session.rotatedAt && Date.now() - session.rotatedAt.getTime() > LOGOUT_ROTATION_GRACE_MS) {
      return;
    }

    // Revoke the whole family, not just the row behind the presented token — otherwise a
    // token rotated moments ago would leave its live successor session refreshable.
    await this.sessions.revokeFamily(session.familyId, 'logout');
    await this.audit.record({
      event: 'logout',
      actorId: session.userId,
      userId: session.userId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
}
