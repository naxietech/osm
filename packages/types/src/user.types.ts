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

/**
 * Request body for `POST /users`. The single home for this shape: the API's Zod schema is
 * checked against it (`create-user.dto.ts`) and the web service types its body with it, so
 * the two cannot drift.
 *
 * `password` is required. It was optional here while the client was on mocks, which made
 * this type disagree with the endpoint it describes — the API has always rejected a create
 * without a temporary password, because there is no invite email to set one later.
 */
export interface CreateUserDto {
  email: string;
  password: string;
  roleId: string; // the assigned Role
  fullName: string;
  instituteId?: string;
}

/**
 * Request body for `PATCH /users/:id`. Every field is optional — an absent one is left
 * alone, which is what makes this a patch rather than a replace.
 *
 * `instituteId` is the exception that needs three states, so `null` is meaningful and
 * distinct from absent: `undefined` leaves the link as it is, `null` unlinks the account.
 * Password and status are not here; each has its own endpoint, because each has side
 * effects (revoking sessions, clearing a lockout) that a general edit must not trigger by
 * accident.
 */
export interface UpdateUserDto {
  email?: string;
  fullName?: string;
  roleId?: string;
  instituteId?: string | null;
}

/**
 * Account lifecycle. `pending` is an invited account with no password set yet; `locked` is
 * a temporary brute-force lockout the server clears on its own, as opposed to `deactivate`,
 * which an admin sets and only an admin can undo.
 *
 * Declared as a runtime array because both apps need the values, not just the type: the API
 * builds its Zod enum and Swagger docs from it, and the web app renders one badge per status.
 * Deriving the type from the array keeps the two from drifting apart.
 */
export const USER_STATUSES = ['pending', 'active', 'deactivate', 'locked'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

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
