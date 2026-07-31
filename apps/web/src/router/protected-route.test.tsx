import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type SafeUser, UserRole } from '@oses/types';

import { AuthProvider } from '@/hooks';
import { mockAuthApi, mockAuthApiDown, mockAuthSession } from '@/test-utils/api-mock';

import { ProtectedRoute } from './protected-route';

const USER: SafeUser = {
  id: 'u',
  email: 'u@oses.pk',
  role: UserRole.SUPER_ADMIN,
  roleId: 'role_super_admin',
  fullName: 'User',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderGate(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/admin" element={<div>Protected Content</div>} />
            </Route>
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// The session and grant queries retry once before giving up, and React Query backs off
// ~1s first — past findBy's default budget. The retry is deliberate (it absorbs a deploy
// blip), so the tests wait for it rather than switching it off.
const AFTER_RETRY = { timeout: 5000 };

describe('ProtectedRoute', () => {
  it('waits rather than assuming signed out', async () => {
    mockAuthApi({ me: USER });
    renderGate();

    // Must not have redirected while /auth/me was still in flight.
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();

    expect(await screen.findByText('Protected Content')).toBeInTheDocument();
  });

  it('renders the page once the session and grants have arrived', async () => {
    mockAuthApi({ me: USER, permissions: [{ action: 'dashboard.view', scope: 'all' }] });
    renderGate();
    expect(await screen.findByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to login on a clean 401', async () => {
    mockAuthApi({ me: null });
    renderGate();
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('offers a retry instead of signing the user out when the server is unreachable', async () => {
    // A 5xx is not a 401. Redirecting here would silently boot every open tab to the
    // login page during an outage, looking exactly like a real expiry.
    mockAuthApiDown(500);
    renderGate();

    expect(await screen.findByRole('alert', {}, AFTER_RETRY)).toHaveTextContent(
      /couldn't reach the server/i,
    );
    expect(screen.getByText(/have not been signed out/i)).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('recovers when the retry succeeds', async () => {
    mockAuthApiDown(500);
    renderGate();
    await screen.findByRole('alert', {}, AFTER_RETRY);

    mockAuthApi({ me: USER });
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Protected Content', {}, AFTER_RETRY)).toBeInTheDocument();
  });

  it('holds the page back when the grants fail to load', async () => {
    // Every can() answers false in this state, so rendering would show a fully
    // permissioned user an app in which they appear to have no rights at all.
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/me')) {
          return Promise.resolve(
            new Response(JSON.stringify({ success: true, data: USER, timestamp: 'now' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ success: false, message: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }),
    );
    renderGate();

    expect(await screen.findByRole('alert', {}, AFTER_RETRY)).toHaveTextContent(
      /couldn't reach the server/i,
    );
    expect(screen.getByText(/permissions could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('does not loop when a signed-out visitor lands on a protected route', async () => {
    // /auth/me 401s, the client attempts a renewal, that 401s too, and the session is
    // cleared. If clearing removed the session query itself, its observer would refetch
    // and the whole cycle would repeat forever.
    const api = mockAuthSession();
    renderGate();

    await screen.findByText('Login Page');
    await waitFor(() => expect(api.paths().filter((p) => p === '/auth/me').length).toBe(1));
    expect(api.paths().filter((p) => p === '/auth/refresh').length).toBe(1);
  });
});
