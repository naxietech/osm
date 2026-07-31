import { type ReactElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type SafeUser, UserRole } from '@oses/types';

import { mockAuthApi } from '@/test-utils/api-mock';

import { AuthProvider, useAuth } from './use-auth';

const ADMIN: SafeUser = {
  id: 'usr_admin',
  email: 'admin@oses.pk',
  role: UserRole.ADMIN,
  roleId: 'role_admin',
  fullName: 'Board Admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** Mirrors the app: the router sits above AuthProvider so it can see the route. */
function makeWrapper(path = '/admin'): ({ children }: { children: ReactNode }) => ReactElement {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>{children}</AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AuthProvider', () => {
  it('reports loading until the session is known', async () => {
    mockAuthApi({ me: ADMIN });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

    // The important case: while /auth/me is in flight we must not claim "signed out",
    // or a page refresh would bounce a signed-in user to the login screen.
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('restores the session from the server on mount', async () => {
    mockAuthApi({ me: ADMIN });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user?.email).toBe('admin@oses.pk');
    expect(result.current.user?.role).toBe(UserRole.ADMIN);
  });

  it('is signed out when the browser holds no session', async () => {
    mockAuthApi({ me: null });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('keeps nothing in localStorage — the session lives in HttpOnly cookies', async () => {
    mockAuthApi({ me: ADMIN });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(localStorage.getItem('oses-auth')).toBeNull();
  });

  it('asks nothing at all on a public route', async () => {
    // The login page has no session to look up. Asking would 401, and the api client
    // answers a 401 by trying to renew — so one pointless request becomes two.
    mockAuthApi({ me: null });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper('/login') });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('signs out and drops the user', async () => {
    mockAuthApi({ me: ADMIN });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    result.current.logout();

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(result.current.user).toBeNull();
  });
});
