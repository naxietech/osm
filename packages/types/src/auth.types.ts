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
