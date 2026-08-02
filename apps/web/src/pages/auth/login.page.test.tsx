import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SESSION_HINT_COOKIE, UserRole } from '@oses/types';

import { AuthProvider } from '@/hooks';

import LoginPage from './login.page';

const USER = {
  id: 'usr_1',
  email: 'superadmin@oses.pk',
  role: UserRole.SUPER_ADMIN,
  roleId: 'role_super_admin',
  fullName: 'System Administrator',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, timestamp: 'now' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function failure(status: number, message: string): Response {
  return new Response(JSON.stringify({ success: false, error: 'Error', message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** No session, and `POST /auth/login` answers with whatever the test supplies. */
function mockLogin(response: Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) return Promise.resolve(response);
      return Promise.resolve(failure(401, 'Unauthorized')); // /auth/me + /auth/refresh
    }),
  );
}

function renderLogin(state?: { notice: string }): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div>Signed In</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function submit(password = 'secret123'): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email address/i), 'superadmin@oses.pk');
  // Scoped to the input: the field's show/hide toggle is also labelled "…password".
  await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), password);
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

beforeEach(() => {
  mockLogin(envelope(USER));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = `${SESSION_HINT_COOKIE}=; max-age=0`;
});

/** Pretend someone has signed in on this browser before — what the API leaves behind. */
function giveSessionHint(): void {
  document.cookie = `${SESSION_HINT_COOKIE}=1`;
}

describe('LoginPage', () => {
  it('signs in and routes to the role home', async () => {
    renderLogin();
    await submit();
    expect(await screen.findByText('Signed In')).toBeInTheDocument();
  });

  it('does not advertise demo accounts or a shared password', () => {
    renderLogin();
    expect(screen.queryByText(/demo account/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/password123/)).not.toBeInTheDocument();
  });

  it('makes no auth requests until the form is submitted', () => {
    // Nothing to look up: a visitor with no session marker has never signed in here.
    // Checking anyway would 401, and the api client answers a 401 by trying to renew —
    // two wasted round trips on the one page guaranteed to be opened by signed-out people.
    renderLogin();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  /**
   * The bug this pair exists for: `isAuthenticated` could only ever read false on `/login`,
   * because the provider never checked the session on a public route. So a signed-in user
   * opening the login page — a bookmark, a second tab, the back button — was shown a sign-in
   * form for an account they were already signed into, and the redirect below could never
   * fire. The marker is what makes asking worthwhile without charging every visitor for it.
   */
  it('sends an already-signed-in visitor to their dashboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input).endsWith('/auth/me')) return Promise.resolve(envelope(USER));
        return Promise.resolve(failure(401, 'Unauthorized'));
      }),
    );
    giveSessionHint();
    renderLogin();

    expect(await screen.findByText('Signed In')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('falls back to the form when the marker is stale', async () => {
    // The cookie outlives its session — cleared server-side, or the account was suspended.
    // The check answers 401, which means signed out, so the form is the right thing to show.
    giveSessionHint();
    renderLogin();

    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('sends only the login request when the form is submitted', async () => {
    renderLogin();
    await submit();
    await screen.findByText('Signed In');

    const paths = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
    expect(paths.filter((p) => p.endsWith('/auth/login'))).toHaveLength(1);
    expect(paths.some((p) => p.endsWith('/auth/refresh'))).toBe(false);
  });

  it("shows the API's own wording for a rejected sign-in", async () => {
    // The API answers a bad email and a bad password identically so this page cannot be
    // used to discover which accounts exist. We must not embellish it.
    mockLogin(failure(401, 'Invalid email or password'));
    renderLogin();
    await submit('wrong-password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('replaces the rate-limit message, which is developer text', async () => {
    mockLogin(failure(429, 'ThrottlerException: Too Many Requests'));
    renderLogin();
    await submit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/too many attempts/i);
    expect(alert).not.toHaveTextContent(/ThrottlerException/);
  });

  it('explains a server outage rather than showing a status code', async () => {
    mockLogin(failure(503, 'Service Unavailable'));
    renderLogin();
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/server is not responding/i);
  });

  it('shows the notice handed over after a password change', () => {
    renderLogin({ notice: 'Password changed. Please sign in with your new password.' });
    expect(screen.getByRole('status')).toHaveTextContent(/password changed/i);
  });

  it('sends an already-signed-in visitor to their home page', async () => {
    // Back button, bookmark, stale tab. Reads the cached session only — a signed-out
    // visitor still reaches this page without any auth request (asserted above).
    renderLogin();
    await submit();
    await screen.findByText('Signed In');

    const before = vi.mocked(fetch).mock.calls.length;
    renderLogin(); // second mount, session already cached
    expect(await screen.findByText('Signed In')).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.length).toBe(before);
  });
});
