/**
 * The reason `useSubjects` gates on the session — the same trap `useRoles` fell into.
 *
 * Signing out drops every cached query. React Query treats a removed query that a mounted
 * screen is still watching as one it must go and fetch again — so without a gate, the subject
 * list asked the server again using the session the user had just ended. That 401 sent the
 * client off to renew a session nobody wanted renewed, and the rejection landed in the audit
 * log looking like a refused token.
 *
 * These tests pin both halves: it fetches while signed in, and it goes quiet once the session
 * is gone. They also pin that the management screen asks for deactivated subjects too.
 */
import { type ReactElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUTH_ME_KEY, AuthProvider } from './use-auth';
import { useSubjects } from './use-subjects';

const SUBJECTS = [
  { id: 'sub-1', code: 'PHY', name: 'Physics', isActive: true },
  { id: 'sub-2', code: 'LAT', name: 'Latin', isActive: false },
];

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
      if (path.startsWith('/subjects')) return Promise.resolve(envelope(SUBJECTS));
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
        <MemoryRouter initialEntries={['/admin/subjects']}>
          <AuthProvider>{children}</AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSubjects', () => {
  it('fetches the subjects once there is a session', async () => {
    const api = mockApi();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useSubjects(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(result.current.subjects).toHaveLength(2));
    expect(api.paths()).toContain('/subjects');
  });

  it('includes deactivated subjects — this is the only screen that can revive one', async () => {
    const api = mockApi();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useSubjects(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(result.current.subjects).toHaveLength(2));
    expect(result.current.subjects.some((s) => !s.isActive)).toBe(true);
    expect(api.paths().some((p) => p.includes('activeOnly'))).toBe(false);
  });

  it('reports loading until the session is known, so empty never reads as "none exist"', async () => {
    mockApi();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useSubjects(), { wrapper: makeWrapper(client) });

    // The query is still disabled at this point and would not report as loading on its own.
    expect(result.current.isLoading).toBe(true);
    expect(result.current.subjects).toEqual([]);

    // Let the session and the fetch settle inside the test, so the pending state update is
    // not left landing after it finishes.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.subjects).toHaveLength(2);
  });

  it('does not ask again after the session is cleared', async () => {
    const api = mockApi();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useSubjects(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(api.paths().filter((p) => p === '/subjects')).toHaveLength(1));

    // Exactly what clearSession() does on sign-out.
    client.setQueryData(AUTH_ME_KEY, null);
    client.removeQueries({
      predicate: (q) => JSON.stringify(q.queryKey) !== JSON.stringify(AUTH_ME_KEY),
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(api.paths().filter((p) => p === '/subjects')).toHaveLength(1);
    expect(api.paths()).not.toContain('/auth/refresh');
  });
});
