import type { PermissionGrant } from '@oses/types';

/**
 * Account lifecycle status. Canonical definition lives here in the domain port; the Kysely
 * schema (`database.types.ts`) imports it, keeping the dependency pointing adapter → port.
 */
export type UserStatus = 'pending' | 'active' | 'suspended' | 'locked';

export interface ListUsersOptions {
  limit: number;
  offset: number;
}

/**
 * Repository ports for the auth module. The auth logic depends on these interfaces
 * only; the Kysely adapters that implement them live in `persistence/kysely/`, so the
 * data layer stays swappable.
 */

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  roleId: string;
  instituteId: string | null;
  fullName: string;
  status: UserStatus;
  mfaEnabled: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  roleId: string;
  fullName: string;
  instituteId?: string | null;
  createdBy?: string | null;
}

export const USER_REPOSITORY = 'USER_REPOSITORY';
export interface UserRepository {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(userId: string): Promise<AuthUserRecord | null>;
  /** One page of users, newest first. */
  list(opts: ListUsersOptions): Promise<AuthUserRecord[]>;
  /** Total user count, for pagination. */
  count(): Promise<number>;
  create(input: CreateUserInput): Promise<AuthUserRecord>;
  /** Set a new password hash; also clears the failed-login counter + lockout (recovery path). */
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  updateStatus(userId: string, status: UserStatus): Promise<void>;
  /** Increment the failed-login counter and return the new value. */
  incrementFailedLogin(userId: string): Promise<number>;
  applyLockout(userId: string, until: Date): Promise<void>;
  /** Reset the failed counter + lockout and stamp last_login_at. */
  markLoginSuccess(userId: string): Promise<void>;
}

export interface CreateSessionInput {
  userId: string;
  refreshHash: string;
  familyId: string;
  expiresAt: Date;
  ip: string | null;
  userAgent: string | null;
}

/** The fields needed to validate + rotate a refresh session. */
export interface SessionRecord {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

export const SESSION_REPOSITORY = 'SESSION_REPOSITORY';
export interface SessionRepository {
  create(input: CreateSessionInput): Promise<string>;
  findByRefreshHash(refreshHash: string): Promise<SessionRecord | null>;
  /** Mark a session as rotated (consumed) and point it at its replacement. */
  markRotated(oldId: string, newId: string): Promise<void>;
  /** Revoke every still-active session in a family — the token-theft response. */
  revokeFamily(familyId: string, reason: string): Promise<void>;
  revokeById(id: string, reason: string): Promise<void>;
  /** Revoke all of a user's active sessions (password change, reset, suspend). */
  revokeAllForUser(userId: string, reason: string): Promise<void>;
}

export type AuthEvent =
  | 'login.success'
  | 'login.failure'
  | 'login.locked'
  | 'login.inactive'
  | 'refresh.success'
  | 'refresh.reuse'
  | 'refresh.invalid'
  | 'refresh.expired'
  | 'logout'
  | 'password.change'
  | 'password.reset'
  | 'user.created'
  | 'account.status';

export interface AuditEntry {
  event: AuthEvent;
  actorId?: string | null;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export const AUTH_AUDIT_REPOSITORY = 'AUTH_AUDIT_REPOSITORY';
export interface AuthAuditRepository {
  record(entry: AuditEntry): Promise<void>;
}

export const GRANTS_REPOSITORY = 'GRANTS_REPOSITORY';
export interface GrantsRepository {
  listByRoleId(roleId: string): Promise<PermissionGrant[]>;
}

/** A role plus its grants, for the roles directory. */
export interface RoleWithGrants {
  id: string;
  name: string;
  isSystem: boolean;
  instituteId: string | null;
  createdAt: Date;
  grants: PermissionGrant[];
}

export const ROLE_REPOSITORY = 'ROLE_REPOSITORY';
export interface RoleRepository {
  listWithGrants(): Promise<RoleWithGrants[]>;
}
