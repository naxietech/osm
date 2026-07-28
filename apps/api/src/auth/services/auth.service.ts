import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type { SafeUser } from '@oses/types';

import { AUTH_CONFIG, type AuthConfig } from '../../config/auth.config';
import { legacyRoleFor } from '../../rbac/legacy-role';
import { hashPassword, verifyPassword } from '../../shared/crypto';
import type { ChangePasswordDto, LoginDto } from '../dto';
import {
  AUTH_AUDIT_REPOSITORY,
  type AuthAuditRepository,
  SESSION_REPOSITORY,
  type SessionRepository,
  USER_REPOSITORY,
  type UserRepository,
} from '../ports';
import { toSafeUser } from '../user-mapper';
import { TokenService } from './token.service';

export interface LoginContext {
  ip: string | null;
  userAgent: string | null;
}

export interface LoginResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * A precomputed argon2id hash (app params) of a throwaway string. Verified against on the
 * unknown-email path so that path pays the same hashing cost as a wrong-password attempt —
 * removing the timing side-channel that would otherwise let a caller enumerate accounts.
 */
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$LJzkt/dgiA3w7NvkJhN93A$VV9kvzNzl4sLu0STHJWJwUfiT6uzjJ5LDolcUppC6lw';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly audit: AuthAuditRepository,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Verify credentials and, on success, open a session. Failures are audited and answered
   * with one uniform message so the response never reveals whether an account exists.
   */
  async login(dto: LoginDto, ctx: LoginContext): Promise<LoginResult> {
    const invalid = new UnauthorizedException('Invalid email or password');
    const user = await this.users.findByEmail(dto.email);

    if (!user) {
      // Equalize timing with the wrong-password path so response latency can't reveal
      // whether the account exists.
      await verifyPassword(DUMMY_PASSWORD_HASH, dto.password);
      await this.audit.record({
        event: 'login.failure',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { email: dto.email, reason: 'no_user' },
      });
      throw invalid;
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.audit.record({
        event: 'login.locked',
        userId: user.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw invalid;
    }

    if (user.status !== 'active' || !user.passwordHash) {
      await this.audit.record({
        event: 'login.inactive',
        userId: user.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { status: user.status },
      });
      throw invalid;
    }

    const ok = await verifyPassword(user.passwordHash, dto.password);
    if (!ok) {
      const attempts = await this.users.incrementFailedLogin(user.id);
      if (attempts >= this.config.lockout.maxAttempts) {
        await this.users.applyLockout(user.id, new Date(Date.now() + this.config.lockout.lockMs));
        // Independent security record — survives even if the audit-log DB write below fails.
        this.logger.warn(
          `Account ${user.id} locked after ${attempts} failed login attempts (ip=${ctx.ip ?? 'unknown'}).`,
        );
      }
      await this.audit.record({
        event: 'login.failure',
        userId: user.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { attempts, reason: 'bad_password' },
      });
      throw invalid;
    }

    await this.users.markLoginSuccess(user.id);

    const { token: refreshToken, hash } = this.tokens.generateRefreshToken();
    await this.sessions.create({
      userId: user.id,
      refreshHash: hash,
      familyId: randomUUID(),
      expiresAt: new Date(Date.now() + this.config.refreshTtlMs),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    const role = legacyRoleFor(user.roleId);
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      role,
      roleId: user.roleId,
      instituteId: user.instituteId ?? undefined,
    });

    await this.audit.record({
      event: 'login.success',
      actorId: user.id,
      userId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { user: toSafeUser(user), accessToken, refreshToken };
  }

  /** Resolve the current user for `/me`, fresh from the store (authoritative status/role). */
  async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await this.users.findById(userId);
    // Reject suspended/inactive accounts even while their short-lived access token is valid.
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Session no longer valid');
    }
    return toSafeUser(user);
  }

  /**
   * Change the caller's own password. Requires the current password, then revokes every
   * session — the user (and any other device) must log in again with the new password.
   */
  async changePassword(userId: string, dto: ChangePasswordDto, ctx: LoginContext): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user?.passwordHash) throw new UnauthorizedException('Session no longer valid');

    if (!(await verifyPassword(user.passwordHash, dto.currentPassword))) {
      await this.audit.record({
        event: 'password.change',
        userId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { result: 'wrong_current_password' },
      });
      throw new BadRequestException('Current password is incorrect');
    }

    await this.users.updatePassword(userId, await hashPassword(dto.newPassword));
    await this.sessions.revokeAllForUser(userId, 'password_change');
    await this.audit.record({
      event: 'password.change',
      actorId: userId,
      userId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
}
