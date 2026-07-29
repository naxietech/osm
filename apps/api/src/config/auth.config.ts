import type { ConfigService } from '@nestjs/config';

export const AUTH_CONFIG = 'AUTH_CONFIG';

export type SameSite = 'lax' | 'strict' | 'none';

export interface AuthConfig {
  /** Access-token lifetime as a JWT `expiresIn` string (e.g. '15m'). */
  accessTtl: string;
  /** Access cookie max-age in ms — derived from `accessTtl` so the two can't drift. */
  accessCookieMaxAgeMs: number;
  /** Refresh-token / refresh cookie lifetime in ms (idle window). */
  refreshTtlMs: number;
  /** Brute-force lockout thresholds. */
  lockout: { maxAttempts: number; lockMs: number };
  cookie: { secure: boolean; sameSite: SameSite; domain?: string };
  accessCookieName: string;
  refreshCookieName: string;
}

const SECOND = 1000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Parse a JWT `expiresIn` value (e.g. '15m', '1h', '7d', '900s', '1.5h', or a bare number of
 * seconds) into milliseconds, so the access cookie's max-age is derived from the same value
 * the token is signed with — no second source of truth to drift. Decimals are allowed to
 * match the `ms()` grammar `jsonwebtoken` actually uses. An unparseable value THROWS (fails
 * fast at boot) rather than silently falling back — a silent fallback is the exact drift this
 * function exists to prevent.
 */
export function durationToMs(ttl: string): number {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?\s*$/.exec(ttl);
  if (!match) {
    throw new Error(
      `Invalid JWT_EXPIRES_IN "${ttl}" — expected a number of seconds or a timespan like 15m, 1h, 7d, 1.5h.`,
    );
  }
  const n = Number(match[1]);
  switch (match[2]) {
    case 'ms':
      return Math.round(n);
    case 's':
      return Math.round(n * SECOND);
    case 'm':
      return Math.round(n * MINUTE);
    case 'h':
      return Math.round(n * HOUR);
    case 'd':
      return Math.round(n * DAY);
    default:
      return Math.round(n * SECOND); // a bare number is seconds, per the JWT convention
  }
}

/** Build the runtime auth config from env, with safe defaults. */
export function loadAuthConfig(config: ConfigService): AuthConfig {
  const isProd = config.get<string>('NODE_ENV') === 'production';
  const accessTtl = config.get<string>('JWT_EXPIRES_IN') ?? '15m';
  return {
    accessTtl,
    accessCookieMaxAgeMs: durationToMs(accessTtl),
    refreshTtlMs: 7 * DAY,
    lockout: { maxAttempts: 5, lockMs: 15 * MINUTE },
    cookie: {
      secure: isProd,
      sameSite: 'lax',
      domain: config.get<string>('COOKIE_DOMAIN') || undefined,
    },
    accessCookieName: 'oses_access',
    refreshCookieName: 'oses_refresh',
  };
}
