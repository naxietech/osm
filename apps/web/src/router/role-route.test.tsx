import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { type SafeUser, UserRole } from '@oses/types';

import { AuthProvider } from '@/hooks';

import { RoleRoute } from './role-route';

function seed(role: UserRole | null): void {
  if (role) {
    const user: SafeUser = {
      id: 'u',
      email: 'u@oses.pk',
      role,
      fullName: 'User',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    localStorage.setItem('oses-auth', JSON.stringify({ user, token: 'tok' }));
  }
}

function renderAt(path: string): void {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RoleRoute allowedRoles={[UserRole.ADMIN]} />}>
            <Route path="/admin" element={<div>Admin Page</div>} />
          </Route>
          <Route path="/unauthorized" element={<div>Forbidden</div>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
});

describe('RoleRoute', () => {
  it('renders the route for an allowed role', () => {
    seed(UserRole.ADMIN);
    renderAt('/admin');
    expect(screen.getByText('Admin Page')).toBeInTheDocument();
  });

  it('redirects a disallowed role to /unauthorized', () => {
    seed(UserRole.EVALUATOR);
    renderAt('/admin');
    expect(screen.getByText('Forbidden')).toBeInTheDocument();
  });

  it('redirects an unauthenticated user to /login', () => {
    seed(null);
    renderAt('/admin');
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });
});
