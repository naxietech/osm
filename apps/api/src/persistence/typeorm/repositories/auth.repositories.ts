import { Injectable, Logger, type Provider } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository, type SelectQueryBuilder } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import type { PermissionAction, PermissionGrant, PermissionScope } from '@oses/types';

import {
  AUTH_AUDIT_REPOSITORY,
  type AuditEntry,
  type AuthAuditRepository,
  type AuthUserRecord,
  type CreateSessionInput,
  type CreateUserInput,
  EmailAlreadyExistsError,
  GRANTS_REPOSITORY,
  type GrantsRepository,
  type ListUsersOptions,
  ROLE_REPOSITORY,
  type RoleRepository,
  type RoleWithGrants,
  SESSION_REPOSITORY,
  type SessionRecord,
  type SessionRepository,
  USER_REPOSITORY,
  type UpdateUserInput,
  type UserFilters,
  type UserRepository,
} from '../../../auth/ports';
import {
  AuthAuditLogEntity,
  PermissionEntity,
  RoleEntity,
  RoleGrantEntity,
  SessionEntity,
  UserEntity,
} from '../entities';
import { isUniqueViolation } from '../pg-errors';

/** Map a persisted user row to the PII-agnostic domain record the ports expose. */
function toAuthUser(u: UserEntity): AuthUserRecord {
  return {
    id: u.id,
    email: u.email,
    passwordHash: u.passwordHash,
    roleId: u.roleId,
    instituteId: u.instituteId,
    fullName: u.fullName,
    status: u.status,
    failedLoginCount: u.failedLoginCount,
    lockedUntil: u.lockedUntil,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  };
}

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(@InjectRepository(UserEntity) private readonly repo: Repository<UserEntity>) {}

  // Every read below adds `deletedAt: IsNull()`. Filtering here rather than in the service is
  // what makes the soft delete real: login goes through findByEmail and ActiveUserGuard through
  // findById, so a deleted account cannot sign in or keep an existing session alive — without
  // either of those call sites needing to know soft delete exists.

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const row = await this.repo.findOne({ where: { email, deletedAt: IsNull() } });
    return row ? toAuthUser(row) : null;
  }

  async findById(userId: string): Promise<AuthUserRecord | null> {
    const row = await this.repo.findOne({ where: { id: userId, deletedAt: IsNull() } });
    return row ? toAuthUser(row) : null;
  }

  /**
   * A page of users, each carrying its institute's name.
   *
   * The join is why: `users.institute_id` is a real foreign key, so one left join costs nothing
   * and answers for the whole page. The alternative — the browser fetching every institute to
   * label twenty-five rows — is a second request that works until there are more institutes than
   * whatever limit it asked for, and then silently blanks the column again.
   *
   * `getRawAndEntities` rather than `getMany`: the name is not a column of `UserEntity` and
   * there is no relation mapped for it, so it arrives on the raw row alongside the hydrated one.
   *
   * `limit`/`offset` rather than `take`/`skip`. With a join present, `take`/`skip` switches
   * TypeORM to a two-query "select the ids, then select the rows" plan that needs entity metadata
   * for every joined alias — and this alias is a bare table name, so it has none and the query
   * throws. Paging in SQL directly is safe here because the join is many-to-one: a user has at
   * most one institute, so no row can be multiplied and no page can come back short.
   */
  async list(opts: ListUsersOptions): Promise<AuthUserRecord[]> {
    const { entities, raw } = await this.filteredQuery(opts)
      .leftJoin('institutes', 'institute', 'institute.id = user.institute_id')
      .addSelect('institute.institute_name', 'institute_name')
      .orderBy('user.created_at', 'DESC')
      .limit(opts.limit)
      .offset(opts.offset)
      .getRawAndEntities();

    return entities.map((entity, index) => ({
      ...toAuthUser(entity),
      instituteName: (raw[index] as { institute_name?: string | null })?.institute_name ?? null,
    }));
  }

  count(opts: UserFilters = {}): Promise<number> {
    return this.filteredQuery(opts).getCount();
  }

  countActiveByRole(roleId: string): Promise<number> {
    return this.repo.count({ where: { roleId, status: 'active', deletedAt: IsNull() } });
  }

  /**
   * Live users, narrowed by any combination of free-text search, status and role. Shared by
   * `list` and `count` so a page and its total can never disagree about what was filtered.
   *
   * `status` and `roleId` are exact matches on indexed columns and stay cheap at any size. The
   * search is a leading-wildcard ILIKE, which cannot use a B-tree index and therefore scans —
   * fine for a staff-sized table, and the reason the two are separate parameters rather than one
   * catch-all box. Revisit with a trigram index if this table ever grows.
   */
  private filteredQuery(f: UserFilters): SelectQueryBuilder<UserEntity> {
    const qb = this.repo.createQueryBuilder('user').where('user.deleted_at is null');
    if (f.status) qb.andWhere('user.status = :status', { status: f.status });
    if (f.roleId) qb.andWhere('user.role_id = :roleId', { roleId: f.roleId });
    const term = f.search?.trim();
    if (term) {
      qb.andWhere('(user.email ilike :term or user.full_name ilike :term)', {
        term: `%${term}%`,
      });
    }
    return qb;
  }

  async create(input: CreateUserInput): Promise<AuthUserRecord> {
    try {
      const saved = await this.repo.save(
        this.repo.create({
          email: input.email,
          passwordHash: input.passwordHash,
          roleId: input.roleId,
          fullName: input.fullName,
          instituteId: input.instituteId ?? null,
          status: 'active',
          createdBy: input.createdBy ?? null,
        }),
      );
      // Re-read so DB-defaulted columns (created_at, status, counters) come back populated,
      // matching the previous RETURNING-based insert exactly.
      const row = await this.repo.findOneByOrFail({ id: saved.id });
      return toAuthUser(row);
    } catch (err) {
      // The email unique constraint fires here even when two concurrent creates both pass the
      // service's pre-check — translate it so the caller gets a 409, never a 500.
      if (isUniqueViolation(err)) throw new EmailAlreadyExistsError();
      throw err;
    }
  }

  async update(userId: string, input: UpdateUserInput): Promise<AuthUserRecord | null> {
    const patch: QueryDeepPartialEntity<UserEntity> = { updatedAt: new Date() };
    if (input.email !== undefined) patch.email = input.email;
    if (input.fullName !== undefined) patch.fullName = input.fullName;
    if (input.roleId !== undefined) patch.roleId = input.roleId;
    if (input.instituteId !== undefined) patch.instituteId = input.instituteId;

    try {
      const result = await this.repo
        .createQueryBuilder()
        .update(UserEntity)
        .set(patch)
        .where('id = :id', { id: userId })
        .andWhere('deleted_at is null')
        .returning('id')
        .execute();

      if (!(result.raw as Array<{ id: string }>)[0]) return null;
      return await this.findById(userId);
    } catch (err) {
      // Same race as `create`: two concurrent edits can both pass the service's pre-check, and
      // the unique index catches the loser — a 409, never a 500.
      if (isUniqueViolation(err)) throw new EmailAlreadyExistsError();
      throw err;
    }
  }

  async softDelete(userId: string): Promise<boolean> {
    const result = await this.repo
      .createQueryBuilder()
      .update(UserEntity)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('id = :id', { id: userId })
      .andWhere('deleted_at is null')
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    // Setting a new password also clears any lockout — an admin reset (or the user's own
    // change) is a recovery path, so a locked-out account must come back usable.
    await this.repo.update(
      { id: userId },
      {
        passwordHash,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
    );
  }

  async updateStatus(userId: string, status: AuthUserRecord['status']): Promise<void> {
    await this.repo.update({ id: userId }, { status, updatedAt: new Date() });
  }

  async incrementFailedLogin(userId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update(UserEntity)
      .set({ failedLoginCount: () => '"failed_login_count" + 1', updatedAt: new Date() })
      .where('id = :id', { id: userId })
      .returning('failed_login_count')
      .execute();
    const row = (result.raw as Array<{ failed_login_count: number }>)[0];
    if (!row) throw new Error(`user ${userId} not found while incrementing failed-login count`);
    return Number(row.failed_login_count);
  }

  async applyLockout(userId: string, until: Date): Promise<void> {
    await this.repo.update({ id: userId }, { lockedUntil: until, updatedAt: new Date() });
  }

  async clearLockout(userId: string): Promise<void> {
    await this.repo.update(
      { id: userId },
      { failedLoginCount: 0, lockedUntil: null, updatedAt: new Date() },
    );
  }

  async markLoginSuccess(userId: string): Promise<void> {
    await this.repo.update(
      { id: userId },
      { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), updatedAt: new Date() },
    );
  }
}

@Injectable()
export class TypeOrmSessionRepository implements SessionRepository {
  constructor(
    @InjectRepository(SessionEntity) private readonly repo: Repository<SessionEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(input: CreateSessionInput): Promise<string> {
    const saved = await this.repo.save(
      this.repo.create({
        userId: input.userId,
        refreshHash: input.refreshHash,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
        ip: input.ip,
        userAgent: input.userAgent,
      }),
    );
    return saved.id;
  }

  async findByRefreshHash(refreshHash: string): Promise<SessionRecord | null> {
    const row = await this.repo.findOne({ where: { refreshHash } });
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      familyId: row.familyId,
      expiresAt: row.expiresAt,
      rotatedAt: row.rotatedAt,
      revokedAt: row.revokedAt,
    };
  }

  async rotateSession(currentId: string, replacement: CreateSessionInput): Promise<boolean> {
    // One transaction: claim the old session (conditional UPDATE — only the first concurrent
    // caller matches `rotated_at IS NULL` and gets a row back; Postgres re-checks the predicate
    // after the row lock, so exactly one racer wins) and, only if the claim wins, insert the
    // replacement. If the claim loses, nothing is minted. If the insert throws, the whole
    // transaction rolls back — the old token is un-rotated again and stays usable.
    return this.dataSource.transaction(async (manager) => {
      const claim = await manager
        .createQueryBuilder()
        .update(SessionEntity)
        .set({ rotatedAt: new Date() })
        .where('id = :id', { id: currentId })
        .andWhere('rotated_at IS NULL')
        .andWhere('revoked_at IS NULL')
        .returning('id')
        .execute();
      const claimed = (claim.raw as Array<{ id: string }>)[0];
      if (!claimed) return false;

      await manager.getRepository(SessionEntity).insert({
        userId: replacement.userId,
        refreshHash: replacement.refreshHash,
        familyId: replacement.familyId,
        expiresAt: replacement.expiresAt,
        ip: replacement.ip,
        userAgent: replacement.userAgent,
      });
      return true;
    });
  }

  async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(SessionEntity)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where('family_id = :familyId', { familyId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  async revokeById(id: string, reason: string): Promise<void> {
    await this.repo.update({ id }, { revokedAt: new Date(), revokedReason: reason });
  }

  async revokeAllForUser(userId: string, reason: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(SessionEntity)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }
}

@Injectable()
export class TypeOrmAuthAuditRepository implements AuthAuditRepository {
  private readonly logger = new Logger(TypeOrmAuthAuditRepository.name);

  constructor(
    @InjectRepository(AuthAuditLogEntity)
    private readonly repo: Repository<AuthAuditLogEntity>,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      // save(create(...)) rather than insert(...): the latter's QueryDeepPartialEntity typing
      // mis-maps the jsonb `metadata` object; DeepPartial (via create) accepts it cleanly.
      await this.repo.save(
        this.repo.create({
          event: entry.event,
          actorId: entry.actorId ?? null,
          userId: entry.userId ?? null,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
          metadata: entry.metadata ?? {},
        }),
      );
    } catch (err) {
      // Audit is best-effort: a failed write must never break the auth flow (e.g. turn a 401
      // into a 500) — but it must never be lost silently either. Log the FULL entry (ip,
      // userAgent, reason/metadata) so this line is a usable backup record for an
      // investigator, not just "some event failed for some user".
      this.logger.error(
        `Failed to persist audit event "${entry.event}" — backup record follows`,
        JSON.stringify({ ...entry, error: err instanceof Error ? err.message : String(err) }),
      );
    }
  }
}

@Injectable()
export class TypeOrmGrantsRepository implements GrantsRepository {
  constructor(
    @InjectRepository(RoleGrantEntity) private readonly repo: Repository<RoleGrantEntity>,
  ) {}

  async listByRoleId(roleId: string): Promise<PermissionGrant[]> {
    // `role_grants` stores a permission id; the action string lives on `permissions`. Joining
    // here keeps that detail inside the persistence layer — callers still get { action, scope }.
    const rows = await this.repo
      .createQueryBuilder('grant')
      .innerJoin(PermissionEntity, 'permission', 'permission.id = grant.permissionId')
      .select('permission.action', 'action')
      .addSelect('grant.scope', 'scope')
      .where('grant.roleId = :roleId', { roleId })
      .getRawMany<{ action: string; scope: PermissionScope }>();

    return rows.map((r) => ({
      // `action` is FK-constrained to the permissions catalogue, so every value is a valid
      // PermissionAction — the cast narrows the DB string, it never widens.
      action: r.action as PermissionAction,
      scope: r.scope,
    }));
  }
}

@Injectable()
export class TypeOrmRoleRepository implements RoleRepository {
  constructor(
    @InjectRepository(RoleEntity) private readonly roles: Repository<RoleEntity>,
    @InjectRepository(RoleGrantEntity) private readonly grants: Repository<RoleGrantEntity>,
  ) {}

  async listWithGrants(): Promise<RoleWithGrants[]> {
    // Ordered by `code` now that `id` is an opaque uuid — sorting by it would be arbitrary.
    const roles = await this.roles.find({ order: { code: 'ASC' } });
    const grants = await this.grants
      .createQueryBuilder('grant')
      .innerJoin(PermissionEntity, 'permission', 'permission.id = grant.permissionId')
      .select('grant.role_id', 'roleId')
      .addSelect('permission.action', 'action')
      .addSelect('grant.scope', 'scope')
      .getRawMany<{ roleId: string; action: string; scope: PermissionScope }>();

    const byRole = new Map<string, PermissionGrant[]>();
    for (const g of grants) {
      const list = byRole.get(g.roleId) ?? [];
      list.push({ action: g.action as PermissionAction, scope: g.scope });
      byRole.set(g.roleId, list);
    }

    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      isSystem: r.isSystem,
      instituteId: r.instituteId,
      createdAt: r.createdAt,
      grants: byRole.get(r.id) ?? [],
    }));
  }
}

/** Binds the auth repository ports to their TypeORM implementations. */
export const AUTH_REPOSITORY_PROVIDERS: Provider[] = [
  { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
  { provide: SESSION_REPOSITORY, useClass: TypeOrmSessionRepository },
  { provide: AUTH_AUDIT_REPOSITORY, useClass: TypeOrmAuthAuditRepository },
  { provide: GRANTS_REPOSITORY, useClass: TypeOrmGrantsRepository },
  { provide: ROLE_REPOSITORY, useClass: TypeOrmRoleRepository },
];
