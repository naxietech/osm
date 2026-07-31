import type { PermissionGrant, UserStatus } from '@oses/types';

/**
 * Account lifecycle status. Now defined in @oses/types, because the web app renders it on
 * the admin user directory; re-exported here so the Kysely schema (`database.types.ts`)
 * and the repositories keep importing it from the domain port.
 */
export type { UserStatus };

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

/**
 * Thrown by `UserRepository.create` when the email already exists (the DB unique constraint
 * fired) — including the race where two concurrent creates pass the pre-check. The service
 * translates this into a 409, so a duplicate never surfaces as a 500.
 */
export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('Email already exists');
    this.name = 'EmailAlreadyExistsError';
  }
}

export const USER_REPOSITORY = 'USER_REPOSITORY';
export interface UserRepository {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(userId: string): Promise<AuthUserRecord | null>;
  /** One page of users, newest first. */
  list(opts: ListUsersOptions): Promise<AuthUserRecord[]>;
  /** Total user count, for pagination. */
  count(): Promise<number>;
  /** Count active users holding a given role — used to protect the last active Super Admin. */
  countActiveByRole(roleId: string): Promise<number>;
  /** Insert a user. Throws {@link EmailAlreadyExistsError} on a duplicate email (incl. races). */
  create(input: CreateUserInput): Promise<AuthUserRecord>;
  /** Set a new password hash; also clears the failed-login counter + lockout (recovery path). */
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  updateStatus(userId: string, status: UserStatus): Promise<void>;
  /** Increment the failed-login counter and return the new value. */
  incrementFailedLogin(userId: string): Promise<number>;
  applyLockout(userId: string, until: Date): Promise<void>;
  /** Clear the failed counter + lockout (without stamping last_login) — e.g. on reactivation. */
  clearLockout(userId: string): Promise<void>;
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
  /**
   * Atomically, in ONE transaction: retire `currentId` **iff it is still live** (not already
   * rotated or revoked) and create its `replacement` in the same family. Returns `true` only
   * for the one caller that wins the claim (single-use guarantee for rotation); concurrent
   * callers presenting the same token all get `false` except one, and mint nothing. Because
   * both steps share a transaction, a failure rolls the retirement back — the old token stays
   * usable and a retry is a normal refresh, not a mis-detected "theft".
   */
  rotateSession(currentId: string, replacement: CreateSessionInput): Promise<boolean>;
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
