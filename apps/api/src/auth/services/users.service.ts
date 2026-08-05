import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AdminUser, PaginatedUsers, SafeUser } from '@oses/types';

import { SYSTEM_ROLE_IDS, roleAcceptsInstitute } from '../../rbac/system-roles';
import { hashPassword } from '../../shared/crypto';
import type {
  CreateUserRequestDto,
  ListUsersQuery,
  ResetPasswordDto,
  UpdateStatusDto,
  UpdateUserDto,
} from '../dto';
import {
  AUTH_AUDIT_REPOSITORY,
  type AuthAuditRepository,
  type AuthUserRecord,
  EmailAlreadyExistsError,
  SESSION_REPOSITORY,
  type SessionRepository,
  USER_REPOSITORY,
  type UpdateUserInput,
  type UserRepository,
} from '../ports';
import { toAdminUser, toSafeUser } from '../user-mapper';

const VALID_ROLE_IDS = new Set<string>(Object.values(SYSTEM_ROLE_IDS));

/**
 * Admin user provisioning (Phase 1, no email): create accounts with a temporary
 * password, reset a locked-out user's password, and activate/deactivate accounts.
 * Every route that reaches here is gated by `@RequirePermissions('users.manage')`.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly audit: AuthAuditRepository,
  ) {}

  /** A page of users (newest first) plus the total count, for the admin directory. */
  async listUsers(query: ListUsersQuery): Promise<PaginatedUsers> {
    const filters = { search: query.q, status: query.status, roleId: query.roleId };
    const [rows, total] = await Promise.all([
      this.users.list({ ...filters, limit: query.limit, offset: query.offset }),
      // Same filters as the page, so "showing 10 of 3" can never happen.
      this.users.count(filters),
    ]);
    return { items: rows.map(toAdminUser), total };
  }

  /** One user, in the same shape the listing returns. */
  async getUser(userId: string): Promise<AdminUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return toAdminUser(user);
  }

  /**
   * Admin edit of an account's email, name, role or institute.
   *
   * A role change revokes the user's sessions, which stops them minting a *new* access token.
   * It cannot un-issue the one already in their browser — that is `ActiveUserGuard`'s job: it
   * compares the token's `roleId` against the account and rejects the mismatch on the next
   * request. The two together are what make a demotion take effect at once; revocation alone
   * would leave the old permissions valid for the rest of the token's ~15-minute life.
   */
  async updateUser(userId: string, dto: UpdateUserDto, actorId: string): Promise<SafeUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (dto.roleId !== undefined && dto.roleId !== user.roleId) {
      if (!VALID_ROLE_IDS.has(dto.roleId)) throw new BadRequestException('Unknown role');
      if (userId === actorId) {
        throw new BadRequestException('You cannot change your own role.');
      }
      await this.assertNotLastSuperAdmin(user, 'change the role of');
    }

    // The pairing is checked against the account as it will be *after* the merge, not against the
    // patch alone — sending `{ roleId: evaluator }` on an institute account has to see the
    // institute id that is already there.
    const nextRoleId = dto.roleId ?? user.roleId;
    const instituteId = this.resolveInstituteId(nextRoleId, dto.instituteId, user.instituteId);
    const instituteCleared = instituteId === null && user.instituteId !== null;

    const patch: UpdateUserInput = { ...dto };
    if (instituteId !== user.instituteId) patch.instituteId = instituteId;

    if (dto.email !== undefined && dto.email !== user.email) {
      const clash = await this.users.findByEmail(dto.email);
      if (clash) throw new ConflictException('A user with that email already exists');
    }

    let updated: AuthUserRecord | null;
    try {
      updated = await this.users.update(userId, patch);
    } catch (err) {
      // Two concurrent edits can both pass the pre-check; the unique index catches the loser.
      if (err instanceof EmailAlreadyExistsError) {
        throw new ConflictException('A user with that email already exists');
      }
      throw err;
    }
    if (!updated) throw new NotFoundException('User not found');

    const roleChanged = dto.roleId !== undefined && dto.roleId !== user.roleId;
    if (roleChanged) await this.sessions.revokeAllForUser(userId, 'role_changed');

    await this.audit.record({
      event: 'account.status',
      actorId,
      userId,
      metadata: {
        changed: Object.keys(patch),
        ...(roleChanged ? { roleId: dto.roleId, sessionsRevoked: true } : {}),
        // Surfaced explicitly: the caller never asked for this, the role change forced it.
        ...(instituteCleared ? { instituteCleared: user.instituteId } : {}),
      },
    });
    return toSafeUser(updated);
  }

  /**
   * Soft delete: the row stays so the audit trail and every `created_by` reference stay intact,
   * but the account vanishes from listings and can no longer sign in (the repository filters
   * deleted rows out of `findByEmail`, which login uses, and `findById`, which the active-user
   * guard uses). Sessions are revoked so an open tab dies immediately rather than at expiry.
   */
  async deleteUser(userId: string, actorId: string): Promise<{ message: string }> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (userId === actorId) throw new BadRequestException('You cannot delete your own account.');
    await this.assertNotLastSuperAdmin(user, 'delete');

    const deleted = await this.users.softDelete(userId);
    if (!deleted) throw new NotFoundException('User not found');

    await this.sessions.revokeAllForUser(userId, 'deleted');
    await this.audit.record({
      event: 'account.status',
      actorId,
      userId,
      metadata: { deleted: true },
    });
    return { message: 'User deleted.' };
  }

  /**
   * Role and institute are coupled, and the coupling has two different strengths:
   *
   * - **May** be linked — any role `roleAcceptsInstitute()` allows: the Institute account itself,
   *   plus an Evaluator, who is often hired by one institute. A global role (Super Admin, Admin,
   *   Controller) may not: the guards treat anyone carrying an instituteId as institute-bound and
   *   lock them out of everything else, so a global role with one is a crippled account.
   * - **Must** be linked — the Institute role only. An Institute account with no institute logs
   *   in fine and sees nothing, with no clue why.
   *
   * Nothing in the schema enforces either half, so this is the only thing standing between a role
   * change and a silently broken account.
   *
   * Returns the institute id to store. Moving onto a role that cannot hold one clears it rather
   * than refusing: an institute id on a global role is meaningless by definition, so nothing is
   * lost, and making the caller send `instituteId: null` as well would turn the common "wrong role
   * at creation" fix into a two-field puzzle. The clearing is recorded in the audit entry.
   *
   * @param explicit  what the caller sent (`undefined` = not mentioned, `null` = unlink)
   * @param existing  what the account carries today
   */
  private resolveInstituteId(
    roleId: string,
    explicit: string | null | undefined,
    existing: string | null = null,
  ): string | null {
    const mayHold = roleAcceptsInstitute(roleId);
    const mustHold = roleId === SYSTEM_ROLE_IDS.institute;

    // Asked for an institute outright — honour it, or say why it cannot apply. Never drop a value
    // the caller deliberately sent; silently ignoring it is how "I set it and it didn't save"
    // bugs are born.
    if (explicit) {
      if (!mayHold) {
        throw new BadRequestException('That role is global and cannot be tied to an institute.');
      }
      return explicit;
    }

    if (!mayHold) return null;

    const kept = explicit === null ? null : existing;
    if (!kept && mustHold) {
      throw new BadRequestException('An Institute account must be linked to an institute.');
    }
    return kept;
  }

  /** The platform must never be left without a Super Admin — only they can undo the damage. */
  private async assertNotLastSuperAdmin(user: AuthUserRecord, action: string): Promise<void> {
    if (user.roleId !== SYSTEM_ROLE_IDS.superAdmin || user.status !== 'active') return;
    if ((await this.users.countActiveByRole(SYSTEM_ROLE_IDS.superAdmin)) <= 1) {
      throw new BadRequestException(`Cannot ${action} the last active Super Admin.`);
    }
  }

  async createUser(dto: CreateUserRequestDto, actorId: string): Promise<SafeUser> {
    if (!VALID_ROLE_IDS.has(dto.roleId)) throw new BadRequestException('Unknown role');
    const instituteId = this.resolveInstituteId(dto.roleId, dto.instituteId);
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('A user with that email already exists');
    }

    const passwordHash = await hashPassword(dto.password);
    let user: AuthUserRecord;
    try {
      user = await this.users.create({
        email: dto.email,
        passwordHash,
        roleId: dto.roleId,
        fullName: dto.fullName,
        instituteId,
        createdBy: actorId,
      });
    } catch (err) {
      // Two concurrent creates can both pass the pre-check above; the DB unique constraint
      // catches the loser — answer with a 409, not a 500.
      if (err instanceof EmailAlreadyExistsError) {
        throw new ConflictException('A user with that email already exists');
      }
      throw err;
    }

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

    const deactivating = dto.status === 'deactivate';
    if (deactivating) {
      // You can't lock yourself out, and the platform can't be left with zero active Super
      // Admins (only they can undo a deactivation).
      if (userId === actorId) {
        throw new BadRequestException('You cannot deactivate your own account.');
      }
      if (
        user.roleId === SYSTEM_ROLE_IDS.superAdmin &&
        user.status === 'active' &&
        (await this.users.countActiveByRole(SYSTEM_ROLE_IDS.superAdmin)) <= 1
      ) {
        throw new BadRequestException('Cannot deactivate the last active Super Admin.');
      }
    }

    await this.users.updateStatus(userId, dto.status);
    if (deactivating) {
      await this.sessions.revokeAllForUser(userId, 'deactivate');
    } else {
      // Reactivation clears any lingering lockout — otherwise the account would still be
      // locked for up to ~15 min after being turned back on.
      await this.users.clearLockout(userId);
    }
    await this.audit.record({
      event: 'account.status',
      actorId,
      userId,
      metadata: { status: dto.status },
    });
    return { message: deactivating ? 'Account deactivated.' : 'Account activated.' };
  }
}
