/**
 * Auth contract shared by the web app and the API.
 *
 * There is deliberately no `AuthTokens` and no `LoginResponse` here. Sessions are HttpOnly
 * cookies — a short-lived access cookie plus a rotating refresh cookie — which JavaScript
 * cannot read by design. Both types used to exist, describing tokens returned in the
 * response body, and both were imported nowhere. A shape that promises the client a
 * readable token is not merely unused: it is a description of the security model we chose
 * against, sitting in the file someone would go to for the truth. `POST /auth/login`
 * answers with `SafeUser` and sets the cookies.
 */
import type { UserRole } from './roles.types';

/**
 * Name of the readable "someone signed in on this browser" marker.
 *
 * The session cookies are HttpOnly and always will be — this is not one of them. It holds no
 * secret, just `1`, and nothing is ever authorised on the strength of it. It exists so the
 * login page can tell a returning signed-in visitor from a first-time one *without asking the
 * server*: the former must be redirected to their dashboard, but calling `/auth/me` for
 * everyone would put a wasted 401 — and the renewal attempt behind it — in front of every
 * genuinely signed-out visitor.
 *
 * Shared because the API writes it and the browser reads it. A renamed cookie on one side and
 * not the other fails silently, which is the whole reason it lives here and not twice.
 */
export const SESSION_HINT_COOKIE = 'oses_session';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  instituteId?: string;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
