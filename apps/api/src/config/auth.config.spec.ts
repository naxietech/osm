import type { ConfigService } from '@nestjs/config';

import { durationToMs, loadAuthConfig } from './auth.config';

describe('durationToMs', () => {
  it.each([
    ['15m', 900_000],
    ['1h', 3_600_000],
    ['7d', 604_800_000],
    ['900s', 900_000],
    ['500ms', 500],
    ['3600', 3_600_000], // a bare number is seconds
  ])('parses %s → %d ms', (input, expected) => {
    expect(durationToMs(input)).toBe(expected);
  });

  it('falls back to the default on an unparseable value', () => {
    expect(durationToMs('nonsense')).toBe(900_000);
  });
});

describe('loadAuthConfig', () => {
  const cfg = (values: Record<string, string>): ConfigService =>
    ({ get: (k: string) => values[k] }) as unknown as ConfigService;

  it('derives accessCookieMaxAgeMs from JWT_EXPIRES_IN so they cannot drift (#5)', () => {
    const c = loadAuthConfig(cfg({ JWT_EXPIRES_IN: '1h' }));
    expect(c.accessTtl).toBe('1h');
    expect(c.accessCookieMaxAgeMs).toBe(3_600_000);
  });

  it('defaults to 15m when JWT_EXPIRES_IN is unset', () => {
    const c = loadAuthConfig(cfg({}));
    expect(c.accessTtl).toBe('15m');
    expect(c.accessCookieMaxAgeMs).toBe(900_000);
  });
});
