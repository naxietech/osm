import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type SafeUser, UserRole } from '@oses/types';

import { AuthProvider } from '@/hooks';
import { mockAuthApi } from '@/test-utils/api-mock';

import { RoleLayout } from './role-layout';

/** Sign an ADMIN in by making `GET /auth/me` answer with them. */
function seedAdmin(): void {
  const user: SafeUser = {
    id: 'u',
    email: 'admin@oses.pk',
    role: UserRole.ADMIN,
    fullName: 'Board Admin',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  mockAuthApi({ me: user });
}

/** Render the shell at /admin with a stub page mounted in its <Outlet/>. */
async function renderShell(): Promise<void> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider>
          <Routes>
            <Route path="/admin" element={<RoleLayout />}>
              <Route index element={<div>Dashboard Content</div>} />
            </Route>
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  // The shell reads the user from the session query, so wait for it to arrive.
  await screen.findByText('Board Admin');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RoleLayout', () => {
  it('renders the active page in the outlet', async () => {
    seedAdmin();
    await renderShell();
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('renders navigation for the signed-in role', async () => {
    seedAdmin();
    await renderShell();
    // Items from the ADMIN nav config.
    expect(screen.getByText('Question Assignments')).toBeInTheDocument();
    expect(screen.getByText('Institutes')).toBeInTheDocument();
  });

  it('does not show the super-admin-only items to an Admin', async () => {
    seedAdmin();
    await renderShell();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Roles & Permissions')).not.toBeInTheDocument();
  });

  /**
   * The Admin's Setup group exists but holds one entry. Categories are the exception among the
   * reference data: an Admin holds `institute-categories.view` because a category is what an
   * institute *is*, and holds no grant at all for subjects, SLOs or classes. Asserting the group
   * is absent — which this used to — would now hide a regression rather than catch one.
   */
  it('gives an Admin a Setup group holding only Institute Categories', async () => {
    seedAdmin();
    await renderShell();

    fireEvent.click(screen.getByText('Setup'));

    expect(screen.getByText('Institute Categories')).toBeInTheDocument();
    expect(screen.queryByText('Subjects')).not.toBeInTheDocument();
    expect(screen.queryByText('SLOs')).not.toBeInTheDocument();
    expect(screen.queryByText('Classes')).not.toBeInTheDocument();
  });

  it('shows the signed-in user', async () => {
    seedAdmin();
    await renderShell();
    expect(screen.getByText('Board Admin')).toBeInTheDocument();
  });

  it('opens and closes the mobile drawer', async () => {
    seedAdmin();
    await renderShell();

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('dialog', { name: /navigation menu/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close menu/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('logs out and redirects to the login page', async () => {
    seedAdmin();
    await renderShell();
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    await waitFor(() => expect(screen.getByText('Login Page')).toBeInTheDocument());
  });
});
