/**
 * Users API — the super-admin account directory. Live against the backend.
 *
 * Every route here requires the `users.manage` grant, which only Super Admin holds, so a
 * 403 from any of them means the caller shouldn't have reached the screen at all.
 *
 * There is no delete: accounts are suspended, never removed, so the audit log and any
 * record created by that user keep pointing at something real.
 */
import type { PaginatedUsers, SafeUser, UserStatus } from '@oses/types';

import { apiRequest } from './api-client';
import { API_ENDPOINTS } from './api-endpoints';

const { users } = API_ENDPOINTS;

/** Rows per page. The API caps `limit` at 200 and rejects anything larger. */
export const USERS_PAGE_SIZE = 25;

export interface ListUsersParams {
  limit?: number;
  offset?: number;
}

/** One page of users, newest first, plus the total so the UI can page through. */
function listUsers({
  limit = USERS_PAGE_SIZE,
  offset = 0,
}: ListUsersParams = {}): Promise<PaginatedUsers> {
  return apiRequest<PaginatedUsers>(`${users.list}?limit=${limit}&offset=${offset}`);
}

export interface CreateUserParams {
  email: string;
  fullName: string;
  roleId: string;
  /** Temporary password, min 8 — the API requires one; there is no invite email yet. */
  password: string;
  instituteId?: string;
}

/**
 * Create an account. A duplicate email comes back as a 409.
 *
 * Returns `SafeUser`, not `AdminUser`: the create route answers with the account as it
 * was just made, before it has a login history, so there is no `status`/`lastLoginAt` to
 * report. Re-read the list to see it with those.
 */
function createUser(params: CreateUserParams): Promise<SafeUser> {
  return apiRequest<SafeUser>(users.create, { method: 'POST', body: params });
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
 * Suspend or reactivate an account. The API refuses to let you suspend yourself or the
 * last active Super Admin, and answers with a message worth showing as-is.
 */
function setStatus(id: string, status: UserStatus): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(users.status(id), {
    method: 'PATCH',
    body: { status },
  });
}

export const usersService = { listUsers, createUser, resetPassword, setStatus };
