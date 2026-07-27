import { Inject, Injectable, type Provider } from '@nestjs/common';
import { sql } from 'kysely';

import type { PermissionAction } from '@oses/types';

import {
  AUTH_AUDIT_REPOSITORY,
  type AuditEntry,
  type AuthAuditRepository,
  type AuthUserRecord,
  type CreateSessionInput,
  GRANTS_REPOSITORY,
  type GrantsRepository,
  type RoleGrant,
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
  'mfa_enabled',
  'failed_login_count',
  'locked_until',
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
  mfa_enabled: boolean;
  failed_login_count: number;
  locked_until: Date | null;
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
    mfaEnabled: row.mfa_enabled,
    failedLoginCount: row.failed_login_count,
    lockedUntil: row.locked_until,
    createdAt: row.created_at,
  };
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

  async markRotated(oldId: string, newId: string): Promise<void> {
    await this.db
      .updateTable('sessions')
      .set({ rotated_at: new Date(), replaced_by: newId })
      .where('id', '=', oldId)
      .execute();
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
}

@Injectable()
export class KyselyAuthAuditRepository implements AuthAuditRepository {
  constructor(@Inject(KYSELY_DB) private readonly db: AppDatabase) {}

  async record(entry: AuditEntry): Promise<void> {
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
  }
}

@Injectable()
export class KyselyGrantsRepository implements GrantsRepository {
  constructor(@Inject(KYSELY_DB) private readonly db: AppDatabase) {}

  async listByRoleId(roleId: string): Promise<RoleGrant[]> {
    const rows = await this.db
      .selectFrom('role_grants')
      .select(['action', 'scope'])
      .where('role_id', '=', roleId)
      .execute();
    return rows.map((r) => ({
      action: r.action as PermissionAction,
      scope: r.scope,
    }));
  }
}

/** Binds the auth repository ports to their Kysely implementations. */
export const AUTH_REPOSITORY_PROVIDERS: Provider[] = [
  { provide: USER_REPOSITORY, useClass: KyselyUserRepository },
  { provide: SESSION_REPOSITORY, useClass: KyselySessionRepository },
  { provide: AUTH_AUDIT_REPOSITORY, useClass: KyselyAuthAuditRepository },
  { provide: GRANTS_REPOSITORY, useClass: KyselyGrantsRepository },
];
