/**
 * Real auth API — the first service wired to the live backend (everything else is
 * still a mock).
 *
 * The API keeps the session in HttpOnly cookies, so nothing here returns or stores a
 * token: `login` sets the cookies as a side effect and `me` is the only way to find out
 * whether the browser still holds a valid session. Renewal is handled inside
 * `api-client` and never needs calling from here.
 */
import type { ChangePasswordRequest, LoginRequest, PermissionGrant, SafeUser } from '@oses/types';

import { apiRequest } from './api-client';
import { API_ENDPOINTS } from './api-endpoints';

const { auth } = API_ENDPOINTS;

/** Sign in. On success the API sets the access + refresh cookies. */
function login(credentials: LoginRequest): Promise<SafeUser> {
  return apiRequest<SafeUser>(auth.login, { method: 'POST', body: credentials });
}

/** The signed-in user, or a 401 if the browser holds no usable session. */
function me(): Promise<SafeUser> {
  return apiRequest<SafeUser>(auth.me);
}

/** The signed-in user's permission grants (action + scope). */
function permissions(): Promise<PermissionGrant[]> {
  return apiRequest<PermissionGrant[]>(auth.permissions);
}

/** Revoke the session server-side and clear the cookies. */
async function logout(): Promise<void> {
  await apiRequest<{ message: string }>(auth.logout, { method: 'POST' });
}

/** Change your own password. The API then revokes every session, so you must sign in again. */
async function changePassword(dto: ChangePasswordRequest): Promise<void> {
  await apiRequest<{ message: string }>(auth.changePassword, { method: 'POST', body: dto });
}

export const authService = { login, me, permissions, logout, changePassword };
