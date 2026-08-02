import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type SafeUser, UserRole } from '@oses/types';

import { AuthProvider } from '@/hooks';
import { mockAuthApi } from '@/test-utils/api-mock';

import { RoleRoute } from './role-route';

/** Sign a user in by making `GET /auth/me` answer with them. */
function seed(role: UserRole | null): void {
  const user: SafeUser | null = role
    ? {
        id: 'u',
        email: 'u@oses.pk',
        role,
        fullName: 'User',
        createdAt: '2026-01-01T00:00:00.000Z',
      }
    : null;
  mockAuthApi({ me: user });
}

function renderAt(path: string): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Routes>
            <Route element={<RoleRoute allowedRoles={[UserRole.ADMIN]} />}>
              <Route path="/admin" element={<div>Admin Page</div>} />
            </Route>
            <Route path="/unauthorized" element={<div>Forbidden</div>} />
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

describe('RoleRoute', () => {
  it('renders the route for an allowed role', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin');
    await waitFor(() => expect(screen.getByText('Admin Page')).toBeInTheDocument());
  });

  it('redirects a disallowed role to /unauthorized', async () => {
    seed(UserRole.EVALUATOR);
    renderAt('/admin');
    await waitFor(() => expect(screen.getByText('Forbidden')).toBeInTheDocument());
  });

  it('redirects an unauthenticated user to /login', async () => {
    seed(null);
    renderAt('/admin');
    await waitFor(() => expect(screen.getByText('Login Page')).toBeInTheDocument());
  });
});
