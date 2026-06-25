import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { type SafeUser, UserRole } from '@oses/types';

import { AuthProvider } from '@/hooks';

import { RoleLayout } from './role-layout';

/** Seed an authenticated ADMIN session in localStorage (read by AuthProvider). */
function seedAdmin(): void {
  const user: SafeUser = {
    id: 'u',
    email: 'admin@oses.pk',
    role: UserRole.ADMIN,
    fullName: 'Board Admin',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  localStorage.setItem('oses-auth', JSON.stringify({ user, token: 'tok' }));
}

/** Render the shell at /admin with a stub page mounted in its <Outlet/>. */
function renderShell(): void {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<RoleLayout />}>
            <Route index element={<div>Dashboard Content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
});

describe('RoleLayout', () => {
  it('renders the active page in the outlet', () => {
    seedAdmin();
    renderShell();
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('renders navigation for the signed-in role', () => {
    seedAdmin();
    renderShell();
    // Items from the ADMIN nav config.
    expect(screen.getByText('Question Assignments')).toBeInTheDocument();
    expect(screen.getByText('Schools')).toBeInTheDocument();
  });

  it('shows the signed-in user', () => {
    seedAdmin();
    renderShell();
    expect(screen.getByText('Board Admin')).toBeInTheDocument();
  });

  it('opens and closes the mobile drawer', () => {
    seedAdmin();
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('dialog', { name: /navigation menu/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close menu/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('logs out and redirects to the login page', () => {
    seedAdmin();
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });
});
