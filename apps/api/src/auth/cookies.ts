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
}

/** Clear both auth cookies (logout). Options must match how they were set. */
export function clearAuthCookies(res: Response, config: AuthConfig): void {
  const base = {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
    path: '/',
  } as const;
  res.clearCookie(config.accessCookieName, base);
  res.clearCookie(config.refreshCookieName, base);
}
