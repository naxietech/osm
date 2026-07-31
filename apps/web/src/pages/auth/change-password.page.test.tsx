import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@oses/types';

import { AuthProvider } from '@/hooks';

import ChangePasswordPage from './change-password.page';

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

/** Signed in, with `POST /auth/password/change` answering however the test wants. */
function mockChange(response: Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/password/change')) return Promise.resolve(response);
      if (url.endsWith('/auth/me')) return Promise.resolve(envelope(USER));
      if (url.endsWith('/auth/logout')) return Promise.resolve(envelope({ message: 'ok' }));
      return Promise.resolve(envelope([]));
    }),
  );
}

function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/account/password']}>
        <AuthProvider>
          <Routes>
            <Route path="/account/password" element={<ChangePasswordPage />} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillIn(fields: {
  current?: string;
  next?: string;
  confirm?: string;
}): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/current password/i), fields.current ?? 'old-secret');
  await user.type(screen.getByLabelText(/^new password/i), fields.next ?? 'new-secret-1');
  await user.type(screen.getByLabelText(/re-type new password/i), fields.confirm ?? 'new-secret-1');
  await user.click(screen.getByRole('button', { name: /change password/i }));
}

beforeEach(() => {
  mockChange(envelope({ message: 'Password changed.' }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ChangePasswordPage', () => {
  it('sends the user back to sign in after a successful change', async () => {
    // The API revokes every session on success, so staying on the page would leave the
    // app holding cookies that no longer work.
    renderPage();
    await fillIn({});
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('rejects a new password shorter than the API allows', async () => {
    renderPage();
    await fillIn({ next: 'short7', confirm: 'short7' });
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('rejects a re-type that does not match', async () => {
    renderPage();
    await fillIn({ next: 'new-secret-1', confirm: 'new-secret-2' });
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
  });

  it('rejects reusing the current password', async () => {
    renderPage();
    await fillIn({ current: 'same-secret-1', next: 'same-secret-1', confirm: 'same-secret-1' });
    expect(await screen.findByText(/must be different/i)).toBeInTheDocument();
  });

  it('surfaces a wrong current password from the server', async () => {
    mockChange(failure(400, 'Current password is incorrect'));
    renderPage();
    await fillIn({});
    expect(await screen.findByRole('alert')).toHaveTextContent(/current password is incorrect/i);
  });

  it('explains the rate limit in plain words', async () => {
    mockChange(failure(429, 'ThrottlerException: Too Many Requests'));
    renderPage();
    await fillIn({});
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i);
  });
});
