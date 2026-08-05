/**
 * Users API — the super-admin account directory. Live against the backend.
 *
 * Every route here requires the `users.manage` grant, which only Super Admin holds, so a
 * 403 from any of them means the caller shouldn't have reached the screen at all.
 *
 * Two ways to switch an account off, and they are not interchangeable: `setStatus` is the
 * reversible one and leaves the account visible, `deleteUser` is one-way — the row survives
 * for the audit trail but nothing in the UI can bring it back, and its email stays taken.
 */
import type {
  AdminUser,
  CreateUserDto,
  PaginatedUsers,
  SafeUser,
  UpdateUserDto,
  UserStatus,
} from '@oses/types';

import { apiRequest } from './api-client';
import { API_ENDPOINTS } from './api-endpoints';

const { users } = API_ENDPOINTS;

/** Rows per page. The API caps `limit` at 200 and rejects anything larger. */
export const USERS_PAGE_SIZE = 25;

export interface ListUsersParams {
  limit?: number;
  offset?: number;
  /** Free-text over email and full name, case-insensitive. */
  q?: string;
  /** Exact account status. */
  status?: UserStatus;
  /** Exact role id. */
  roleId?: string;
}

/**
 * Builds the query string, leaving out anything blank.
 *
 * Sending `status=` (empty) is not the same as sending nothing: the API validates the value
 * against a fixed set, so an empty one is a 400 rather than "no filter".
 */
function listQuery({
  limit = USERS_PAGE_SIZE,
  offset = 0,
  q,
  status,
  roleId,
}: ListUsersParams): string {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (q?.trim()) params.set('q', q.trim());
  if (status) params.set('status', status);
  if (roleId) params.set('roleId', roleId);
  return params.toString();
}

/**
 * One page of users, newest first, plus the total so the UI can page through.
 *
 * `total` counts everything the filters match, not the page — the API narrows both with the
 * same set, so it is safe to drive "showing 1–25 of 132" and the page count from it.
 */
function listUsers(params: ListUsersParams = {}): Promise<PaginatedUsers> {
  return apiRequest<PaginatedUsers>(`${users.list}?${listQuery(params)}`);
}

/** One account, for the edit screen — including `status` and `lastLoginAt`. */
function getUser(id: string): Promise<AdminUser> {
  return apiRequest<AdminUser>(users.get(id));
}

/**
 * Create an account. A duplicate email comes back as a 409.
 *
 * Returns `SafeUser`, not `AdminUser`: the create route answers with the account as it
 * was just made, before it has a login history, so there is no `status`/`lastLoginAt` to
 * report. Re-read the list to see it with those.
 */
function createUser(dto: CreateUserDto): Promise<SafeUser> {
  return apiRequest<SafeUser>(users.create, { method: 'POST', body: dto });
}

/**
 * Edit an account's email, name, role or institute. Send only what changed — the API
 * rejects an empty patch, and every key present is treated as a deliberate change.
 *
 * `instituteId: null` unlinks; omitting it leaves the link alone. Changing the role signs
 * the user out everywhere, because their access token carries the old role.
 */
function updateUser(id: string, dto: UpdateUserDto): Promise<SafeUser> {
  return apiRequest<SafeUser>(users.update(id), { method: 'PATCH', body: dto });
}

/**
 * Soft delete. The row is kept so the audit trail and every `created_by` reference stay
 * intact, but the account disappears from the directory, cannot sign in, and its sessions
 * are revoked at once. There is no restore endpoint, and the email stays taken.
 */
function deleteUser(id: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(users.remove(id), { method: 'DELETE' });
}

/**
 * Set a new temporary password for someone locked out. The API also signs them out
 * everywhere, so the old password can't keep a stolen session alive.
 */
function resetPassword(id: string, password: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(users.resetPassword(id), {
    method: 'POST',
    body: { password },
  });
}

/**
 * Deactivate or reactivate an account. The API refuses to let you deactivate yourself or
 * the last active Super Admin, and answers with a message worth showing as-is.
 */
function setStatus(id: string, status: UserStatus): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(users.status(id), {
    method: 'PATCH',
    body: { status },
  });
}

export const usersService = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  setStatus,
};
