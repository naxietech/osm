import type { ConfigService } from '@nestjs/config';

export const AUTH_CONFIG = 'AUTH_CONFIG';

export type SameSite = 'lax' | 'strict' | 'none';

export interface AuthConfig {
  /** Access-token lifetime as a JWT `expiresIn` string (e.g. '15m'). */
  accessTtl: string;
  /**
   * Access cookie max-age in ms. Independent literal (below) — not derived from `accessTtl`,
   * so keep the two aligned by hand if you change the token lifetime.
   */
  accessCookieMaxAgeMs: number;
  /** Refresh-token / refresh cookie lifetime in ms (idle window). */
  refreshTtlMs: number;
  /** Brute-force lockout thresholds. */
  lockout: { maxAttempts: number; lockMs: number };
  cookie: { secure: boolean; sameSite: SameSite; domain?: string };
  accessCookieName: string;
  refreshCookieName: string;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Build the runtime auth config from env, with safe defaults. */
export function loadAuthConfig(config: ConfigService): AuthConfig {
  const isProd = config.get<string>('NODE_ENV') === 'production';
  return {
    accessTtl: config.get<string>('JWT_EXPIRES_IN') ?? '15m',
    accessCookieMaxAgeMs: 15 * MINUTE,
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
