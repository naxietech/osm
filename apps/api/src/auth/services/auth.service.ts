import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type { SafeUser } from '@oses/types';

import { AUTH_CONFIG, type AuthConfig } from '../../config/auth.config';
import { legacyRoleFor } from '../../rbac/legacy-role';
import { verifyPassword } from '../../shared/crypto';
import type { LoginDto } from '../dto/login.dto';
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

@Injectable()
export class AuthService {
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
    if (!user) throw new UnauthorizedException('Session no longer valid');
    return toSafeUser(user);
  }
}
