import { Inject, Injectable, Logger, type Provider } from '@nestjs/common';
import { sql } from 'kysely';

import type { PermissionAction, PermissionGrant } from '@oses/types';

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
  type UserRepository,
} from '../../auth/ports';
import { type AppDatabase, KYSELY_DB } from '../database.token';

const USER_COLUMNS = [
  'id',
  'email',
  'password_hash',
  'role_id',
  'institute_id',
  'full_name',
  'status',
  'failed_login_count',
  'locked_until',
  'last_login_at',
  'created_at',
] as const;

type UserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  role_id: string;
  institute_id: string | null;
  full_name: string;
  status: AuthUserRecord['status'];
  failed_login_count: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  created_at: Date;
};

function toAuthUser(row: UserRow): AuthUserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    roleId: row.role_id,
    instituteId: row.institute_id,
    fullName: row.full_name,
    status: row.status,
    failedLoginCount: row.failed_login_count,
    lockedUntil: row.locked_until,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

/** Postgres unique-violation SQLSTATE — raised when the email unique index rejects a row. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === '23505'
  );
}

@Injectable()
export class KyselyUserRepository implements UserRepository {
  constructor(@Inject(KYSELY_DB) private readonly db: AppDatabase) {}

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const row = await this.db
      .selectFrom('users')
      .select(USER_COLUMNS)
      .where('email', '=', email)
      .executeTakeFirst();
    return row ? toAuthUser(row) : null;
  }

  async findById(userId: string): Promise<AuthUserRecord | null> {
    const row = await this.db
      .selectFrom('users')
      .select(USER_COLUMNS)
      .where('id', '=', userId)
      .executeTakeFirst();
    return row ? toAuthUser(row) : null;
  }

  async list(opts: ListUsersOptions): Promise<AuthUserRecord[]> {
    const rows = await this.db
      .selectFrom('users')
      .select(USER_COLUMNS)
      .orderBy('created_at', 'desc')
      .limit(opts.limit)
      .offset(opts.offset)
      .execute();
    return rows.map(toAuthUser);
  }

  async count(): Promise<number> {
    const row = await this.db
      .selectFrom('users')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async countActiveByRole(roleId: string): Promise<number> {
    const row = await this.db
      .selectFrom('users')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('role_id', '=', roleId)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async create(input: CreateUserInput): Promise<AuthUserRecord> {
    try {
      const row = await this.db
        .insertInto('users')
        .values({
          email: input.email,
          password_hash: input.passwordHash,
          role_id: input.roleId,
          full_name: input.fullName,
          institute_id: input.instituteId ?? null,
          status: 'active',
          created_by: input.createdBy ?? null,
        })
        .returning(USER_COLUMNS)
        .executeTakeFirstOrThrow();
      return toAuthUser(row);
    } catch (err) {
      // The email unique constraint fires here even when two concurrent creates both pass the
      // service's pre-check — translate it so the caller gets a 409, never a 500.
      if (isUniqueViolation(err)) throw new EmailAlreadyExistsError();
      throw err;
    }
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    // Setting a new password also clears any lockout — an admin reset (or the user's own
    // change) is a recovery path, so a locked-out account must come back usable.
    await this.db
      .updateTable('users')
      .set({
        password_hash: passwordHash,
        password_changed_at: new Date(),
        failed_login_count: 0,
        locked_until: null,
        updated_at: new Date(),
      })
      .where('id', '=', userId)
      .execute();
  }

  async updateStatus(userId: string, status: AuthUserRecord['status']): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ status, updated_at: new Date() })
      .where('id', '=', userId)
      .execute();
  }

  async incrementFailedLogin(userId: string): Promise<number> {
    const row = await this.db
      .updateTable('users')
      .set({ failed_login_count: sql<number>`failed_login_count + 1`, updated_at: new Date() })
      .where('id', '=', userId)
      .returning('failed_login_count')
      .executeTakeFirstOrThrow();
    return row.failed_login_count;
  }

  async applyLockout(userId: string, until: Date): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ locked_until: until, updated_at: new Date() })
      .where('id', '=', userId)
      .execute();
  }

  async clearLockout(userId: string): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ failed_login_count: 0, locked_until: null, updated_at: new Date() })
      .where('id', '=', userId)
      .execute();
  }

  async markLoginSuccess(userId: string): Promise<void> {
    await this.db
      .updateTable('users')
      .set({
        failed_login_count: 0,
        locked_until: null,
        last_login_at: new Date(),
        updated_at: new Date(),
      })
      .where('id', '=', userId)
      .execute();
  }
}

@Injectable()
export class KyselySessionRepository implements SessionRepository {
  constructor(@Inject(KYSELY_DB) private readonly db: AppDatabase) {}

  async create(input: CreateSessionInput): Promise<string> {
    const row = await this.db
      .insertInto('sessions')
      .values({
        user_id: input.userId,
        refresh_hash: input.refreshHash,
        family_id: input.familyId,
        expires_at: input.expiresAt,
        ip: input.ip,
        user_agent: input.userAgent,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async findByRefreshHash(refreshHash: string): Promise<SessionRecord | null> {
    const row = await this.db
      .selectFrom('sessions')
      .select(['id', 'user_id', 'family_id', 'expires_at', 'rotated_at', 'revoked_at'])
      .where('refresh_hash', '=', refreshHash)
      .executeTakeFirst();
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      familyId: row.family_id,
      expiresAt: row.expires_at,
      rotatedAt: row.rotated_at,
      revokedAt: row.revoked_at,
    };
  }

  async rotateSession(currentId: string, replacement: CreateSessionInput): Promise<boolean> {
    // One transaction: claim the old session (conditional UPDATE — only the first concurrent
    // caller matches `rotated_at IS NULL` and gets a row back; Postgres re-checks the predicate
    // after the row lock, so exactly one racer wins) and, only if the claim wins, insert the
    // replacement. If the claim loses, nothing is minted. If the insert throws, the whole
    // transaction rolls back — the old token is un-rotated again and stays usable.
    return this.db.transaction().execute(async (trx) => {
      const claimed = await trx
        .updateTable('sessions')
        .set({ rotated_at: new Date() })
        .where('id', '=', currentId)
        .where('rotated_at', 'is', null)
        .where('revoked_at', 'is', null)
        .returning('id')
        .executeTakeFirst();
      if (!claimed) return false;

      await trx
        .insertInto('sessions')
        .values({
          user_id: replacement.userId,
          refresh_hash: replacement.refreshHash,
          family_id: replacement.familyId,
          expires_at: replacement.expiresAt,
          ip: replacement.ip,
          user_agent: replacement.userAgent,
        })
        .execute();
      return true;
    });
  }

  async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.db
      .updateTable('sessions')
      .set({ revoked_at: new Date(), revoked_reason: reason })
      .where('family_id', '=', familyId)
      .where('revoked_at', 'is', null)
      .execute();
  }

  async revokeById(id: string, reason: string): Promise<void> {
    await this.db
      .updateTable('sessions')
      .set({ revoked_at: new Date(), revoked_reason: reason })
      .where('id', '=', id)
      .execute();
  }

  async revokeAllForUser(userId: string, reason: string): Promise<void> {
    await this.db
      .updateTable('sessions')
      .set({ revoked_at: new Date(), revoked_reason: reason })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute();
  }
}

@Injectable()
export class KyselyAuthAuditRepository implements AuthAuditRepository {
  private readonly logger = new Logger(KyselyAuthAuditRepository.name);

  constructor(@Inject(KYSELY_DB) private readonly db: AppDatabase) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.db
        .insertInto('auth_audit_log')
        .values({
          event: entry.event,
          actor_id: entry.actorId ?? null,
          user_id: entry.userId ?? null,
          ip: entry.ip ?? null,
          user_agent: entry.userAgent ?? null,
          metadata: JSON.stringify(entry.metadata ?? {}),
        })
        .execute();
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
export class KyselyGrantsRepository implements GrantsRepository {
  constructor(@Inject(KYSELY_DB) private readonly db: AppDatabase) {}

  async listByRoleId(roleId: string): Promise<PermissionGrant[]> {
    const rows = await this.db
      .selectFrom('role_grants')
      .select(['action', 'scope'])
      .where('role_id', '=', roleId)
      .execute();
    return rows.map((r) => ({
      // `action` is stored as text but FK-constrained to the permissions catalogue, so every
      // value is a valid PermissionAction — the cast narrows the DB string, it never widens.
      action: r.action as PermissionAction,
      scope: r.scope,
    }));
  }
}

@Injectable()
export class KyselyRoleRepository implements RoleRepository {
  constructor(@Inject(KYSELY_DB) private readonly db: AppDatabase) {}

  async listWithGrants(): Promise<RoleWithGrants[]> {
    const roles = await this.db
      .selectFrom('roles')
      .select(['id', 'name', 'is_system', 'institute_id', 'created_at'])
      .orderBy('id')
      .execute();
    const grants = await this.db
      .selectFrom('role_grants')
      .select(['role_id', 'action', 'scope'])
      .execute();

    const byRole = new Map<string, PermissionGrant[]>();
    for (const g of grants) {
      const list = byRole.get(g.role_id) ?? [];
      list.push({ action: g.action as PermissionAction, scope: g.scope });
      byRole.set(g.role_id, list);
    }

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      isSystem: r.is_system,
      instituteId: r.institute_id,
      createdAt: r.created_at,
      grants: byRole.get(r.id) ?? [],
    }));
  }
}

/** Binds the auth repository ports to their Kysely implementations. */
export const AUTH_REPOSITORY_PROVIDERS: Provider[] = [
  { provide: USER_REPOSITORY, useClass: KyselyUserRepository },
  { provide: SESSION_REPOSITORY, useClass: KyselySessionRepository },
  { provide: AUTH_AUDIT_REPOSITORY, useClass: KyselyAuthAuditRepository },
  { provide: GRANTS_REPOSITORY, useClass: KyselyGrantsRepository },
  { provide: ROLE_REPOSITORY, useClass: KyselyRoleRepository },
];
