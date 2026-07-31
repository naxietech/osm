import type { UserRole } from './roles.types';

// SafeUser: never includes password or sensitive fields.
// Use this type for all API responses that return user data.
export interface SafeUser {
  id: string;
  email: string;
  role: UserRole; // legacy enum — retained during the RBAC transition
  roleId?: string; // references a Role (data-driven RBAC); resolves grants
  instituteId?: string;
  fullName: string;
  createdAt: string;
}

export interface CreateUserDto {
  email: string;
  password?: string; // set by the super admin / server-side; optional in the client mock
  roleId: string; // the assigned Role
  fullName: string;
  instituteId?: string;
}

/**
 * Account lifecycle. `pending` is an invited account with no password set yet; `locked` is
 * a temporary brute-force lockout the server clears on its own, as opposed to `suspended`,
 * which an admin sets and only an admin can undo.
 */
export type UserStatus = 'pending' | 'active' | 'suspended' | 'locked';

/**
 * A user as the admin directory sees them: `SafeUser` plus the account-management fields.
 * Still never carries a password hash or any other secret.
 */
export interface AdminUser extends SafeUser {
  status: UserStatus;
  lastLoginAt: string | null;
}

/** One page of the admin user directory, newest first. */
export interface PaginatedUsers {
  items: AdminUser[];
  total: number;
}
