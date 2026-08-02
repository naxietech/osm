/**
 * The reason `useRoles` gates on the session.
 *
 * Signing out drops every cached query. React Query treats a removed query that a mounted
 * screen is still watching as a query it must go and fetch again — so without a gate, the
 * roles list asked the server again using the session the user had just ended. That 401 sent
 * the client off to renew a session nobody wanted renewed, and the rejection landed in the
 * audit log looking like a refused token.
 *
 * These tests pin both halves: it fetches while signed in, and it goes quiet the moment the
 * session is gone.
 */
import { type ReactElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUTH_ME_KEY, AuthProvider } from './use-auth';
import { useRoles } from './use-roles';

const ROLES = [{ id: 'role_admin', name: 'Admin', isSystem: true, grants: [], createdAt: 'x' }];

function envelope(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: status < 400, data, timestamp: 'now' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Every path fetched, in order — so a test can count what sign-out actually sent. */
function mockApi(): { paths: () => string[] } {
  const paths: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const path = String(url).replace(/^.*\/api\/v1/, '');
      paths.push(path);
      if (path === '/roles') return Promise.resolve(envelope(ROLES));
      if (path === '/auth/me') return Promise.resolve(envelope({ id: 'u1' }));
      return Promise.resolve(envelope(null));
    }),
  );
  return { paths: () => paths };
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/admin/users']}>
          <AuthProvider>{children}</AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useRoles', () => {
  it('fetches the roles once there is a session', async () => {
    const api = mockApi();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useRoles(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(result.current.roles).toHaveLength(1));
    expect(api.paths()).toContain('/roles');
  });

  it('does not ask again after the session is cleared', async () => {
    const api = mockApi();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useRoles(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(api.paths().filter((p) => p === '/roles')).toHaveLength(1));

    // Exactly what clearSession() does on sign-out.
    client.setQueryData(AUTH_ME_KEY, null);
    client.removeQueries({
      predicate: (q) => JSON.stringify(q.queryKey) !== JSON.stringify(AUTH_ME_KEY),
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Before the gate this was 2: the second one carried the cancelled session, came back
    // 401, and triggered a doomed /auth/refresh behind it.
    expect(api.paths().filter((p) => p === '/roles')).toHaveLength(1);
    expect(api.paths()).not.toContain('/auth/refresh');
  });
});
