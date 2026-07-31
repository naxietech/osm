/**
 * Stubs `fetch` so tests can drive the auth API without a running backend.
 *
 * Stubbing the transport rather than the service keeps the real api-client in the path,
 * so a test still exercises envelope unwrapping and the 401 handling.
 */
import { vi } from 'vitest';

import type { PermissionGrant, SafeUser } from '@oses/types';

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, timestamp: 'now' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unauthorized(): Response {
  return new Response(
    JSON.stringify({ success: false, error: 'Unauthorized', message: 'Unauthorized' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  );
}

export interface ApiMockOptions {
  /** The user `GET /auth/me` returns. Omit or pass null for a signed-out browser. */
  me?: SafeUser | null;
  /** The grants `GET /auth/permissions` returns. Defaults to none. */
  permissions?: PermissionGrant[];
}

/** Point the auth endpoints at fixed answers. Call `vi.unstubAllGlobals()` to undo. */
export function mockAuthApi(options: ApiMockOptions = {}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(options.me ? envelope(options.me) : unauthorized());
      }
      if (url.endsWith('/auth/permissions')) {
        return Promise.resolve(envelope(options.permissions ?? []));
      }
      if (url.endsWith('/auth/logout')) {
        return Promise.resolve(envelope({ message: 'Logged out' }));
      }
      return Promise.resolve(unauthorized());
    }),
  );
}

export interface AuthSessionMock {
  /** Make the API answer as this user, with these grants. */
  signIn: (user: SafeUser, permissions?: PermissionGrant[]) => void;
  /** Make the API answer as signed out. */
  signOut: () => void;
  /** Every path requested so far, in order. */
  paths: () => string[];
}

/**
 * A *stateful* auth API mock, for flows that span more than one session — signing out and
 * back in as a different user on the same tab, for instance, where what the endpoints
 * return has to change midway.
 */
export function mockAuthSession(): AuthSessionMock {
  let current: SafeUser | null = null;
  let grants: PermissionGrant[] = [];
  const paths: string[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      paths.push(url.replace(/^.*\/api\/v1/, ''));

      if (url.endsWith('/auth/logout')) {
        current = null;
        grants = [];
        return Promise.resolve(envelope({ message: 'Logged out' }));
      }
      if (url.endsWith('/auth/me') || url.endsWith('/auth/login')) {
        return Promise.resolve(current ? envelope(current) : unauthorized());
      }
      if (url.endsWith('/auth/permissions')) {
        return Promise.resolve(current ? envelope(grants) : unauthorized());
      }
      return Promise.resolve(unauthorized());
    }),
  );

  return {
    signIn: (user, permissions = []) => {
      current = user;
      grants = permissions;
    },
    signOut: () => {
      current = null;
      grants = [];
    },
    paths: () => paths,
  };
}

/** Make every auth endpoint fail with a server error, for the "backend is down" path. */
export function mockAuthApiDown(status = 500): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ success: false, error: 'Error', message: 'Internal server error' }),
          { status, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    ),
  );
}
