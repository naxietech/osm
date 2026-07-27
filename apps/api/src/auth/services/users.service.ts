import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { SafeUser } from '@oses/types';

import { SYSTEM_ROLE_IDS } from '../../rbac/system-roles';
import { hashPassword } from '../../shared/crypto';
import type { CreateUserDto, ResetPasswordDto, UpdateStatusDto } from '../dto';
import {
  AUTH_AUDIT_REPOSITORY,
  type AuthAuditRepository,
  SESSION_REPOSITORY,
  type SessionRepository,
  USER_REPOSITORY,
  type UserRepository,
} from '../ports';
import { toSafeUser } from '../user-mapper';

const VALID_ROLE_IDS = new Set<string>(Object.values(SYSTEM_ROLE_IDS));

/**
 * Admin user provisioning (Phase 1, no email): create accounts with a temporary
 * password, reset a locked-out user's password, and suspend/reactivate accounts.
 * Every route that reaches here is gated by `@RequirePermissions('users.manage')`.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly audit: AuthAuditRepository,
  ) {}

  async createUser(dto: CreateUserDto, actorId: string): Promise<SafeUser> {
    if (!VALID_ROLE_IDS.has(dto.roleId)) throw new BadRequestException('Unknown role');
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('A user with that email already exists');
    }

    const user = await this.users.create({
      email: dto.email,
      passwordHash: await hashPassword(dto.password),
      roleId: dto.roleId,
      fullName: dto.fullName,
      instituteId: dto.instituteId ?? null,
      createdBy: actorId,
    });

    await this.audit.record({
      event: 'user.created',
      actorId,
      userId: user.id,
      metadata: { roleId: dto.roleId },
    });
    return toSafeUser(user);
  }

  async resetPassword(
    userId: string,
    dto: ResetPasswordDto,
    actorId: string,
  ): Promise<{ message: string }> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    await this.users.updatePassword(userId, await hashPassword(dto.password));
    await this.sessions.revokeAllForUser(userId, 'admin_reset');
    await this.audit.record({ event: 'password.reset', actorId, userId });
    return { message: 'Password reset. The user must log in with the new password.' };
  }

  async setStatus(
    userId: string,
    dto: UpdateStatusDto,
    actorId: string,
  ): Promise<{ message: string }> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    await this.users.updateStatus(userId, dto.status);
    if (dto.status === 'suspended') {
      await this.sessions.revokeAllForUser(userId, 'suspended');
    }
    await this.audit.record({
      event: 'account.status',
      actorId,
      userId,
      metadata: { status: dto.status },
    });
    return { message: `Account ${dto.status}.` };
  }
}
