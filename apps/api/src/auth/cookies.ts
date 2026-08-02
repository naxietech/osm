import type { Response } from 'express';

import type { AuthConfig } from '../config/auth.config';

/** Set the access + refresh tokens as Secure, HttpOnly cookies. */
export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  config: AuthConfig,
): void {
  const base = {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
    path: '/',
  } as const;

  res.cookie(config.accessCookieName, tokens.accessToken, {
    ...base,
    maxAge: config.accessCookieMaxAgeMs,
  });
  res.cookie(config.refreshCookieName, tokens.refreshToken, {
    ...base,
    maxAge: config.refreshTtlMs,
  });

  // Readable on purpose (`httpOnly: false`) and worth nothing on its own — it says only that
  // someone signed in on this browser. The login page reads it to decide whether asking
  // `/auth/me` is worth a round trip. Nothing is authorised on the strength of it.
  res.cookie(config.sessionHintCookieName, '1', {
    ...base,
    httpOnly: false,
    maxAge: config.refreshTtlMs,
  });
}

/** Clear every auth cookie (logout, password change). Options must match how they were set. */
export function clearAuthCookies(res: Response, config: AuthConfig): void {
  const base = {
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
    path: '/',
  } as const;
  res.clearCookie(config.accessCookieName, { ...base, httpOnly: true });
  res.clearCookie(config.refreshCookieName, { ...base, httpOnly: true });
  // Must go too: left behind, it would send the login page to ask `/auth/me` on every visit
  // for a session that no longer exists — the wasted round trip the marker exists to prevent.
  res.clearCookie(config.sessionHintCookieName, { ...base, httpOnly: false });
}
