import type { ColumnType, Generated } from 'kysely';

import type { PermissionScope } from '@oses/types';

import type { UserStatus } from '../../auth/ports';

/**
 * Kysely schema for the auth persistence layer. Column types mirror the migrations
 * in `migrations/`. `Generated<T>` marks columns with a DB default (optional on insert);
 * `Timestamp` accepts Date/ISO-string on write and returns Date on read.
 *
 * This is the single typed contract the repository adapters query against.
 */
type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type Json = ColumnType<Record<string, unknown>, string | undefined, string>;

export interface RolesTable {
  id: string; // stable slug, e.g. 'role_super_admin' — matches @oses/types Role.id
  name: string;
  is_system: Generated<boolean>;
  institute_id: string | null; // set = custom role owned by one institute
  created_at: Timestamp;
}

/** Catalogue of valid permission actions — FK target so a grant can't name an unknown action. */
export interface PermissionsTable {
  action: string; // one of @oses/types PermissionAction
}

export interface RoleGrantsTable {
  role_id: string;
  action: string;
  scope: PermissionScope; // 'all' | 'own-institute'
}

export interface UsersTable {
  id: Generated<string>;
  email: string; // citext — case-insensitive unique
  password_hash: string | null; // null until set (pending invite / bootstrap)
  role_id: string;
  institute_id: string | null; // tenant binding for Institute users
  full_name: string;
  status: Generated<UserStatus>;
  failed_login_count: Generated<number>;
  locked_until: Timestamp | null;
  last_login_at: Timestamp | null;
  password_changed_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: string | null;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  refresh_hash: string; // hash of the opaque refresh token, never the token itself
  family_id: string; // rotation chain — reuse of a retired token revokes the family
  issued_at: Timestamp;
  expires_at: Timestamp;
  rotated_at: Timestamp | null;
  revoked_at: Timestamp | null;
  revoked_reason: string | null;
  replaced_by: string | null;
  ip: string | null;
  user_agent: string | null;
}

export interface AuthAuditLogTable {
  id: Generated<string>; // bigint identity — pg driver returns it as string
  event: string;
  actor_id: string | null;
  user_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Json;
  created_at: Timestamp;
}

export interface Database {
  users: UsersTable;
  roles: RolesTable;
  permissions: PermissionsTable;
  role_grants: RoleGrantsTable;
  sessions: SessionsTable;
  auth_audit_log: AuthAuditLogTable;
}
