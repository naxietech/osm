import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { type SafeUser, UserRole } from '@oses/types';

import { AuthProvider, ClientProvider } from '@/hooks';

import { RouterConfig } from './router';

/**
 * Mounts the real route tree. These cover the module route factories in ./modules —
 * in particular that a module shared by two roles (exams: admin + controller;
 * students: admin + institute) resolves under BOTH path prefixes, which is the thing
 * a typecheck cannot prove.
 */
function seed(role: UserRole): void {
  const user: SafeUser = {
    id: 'u',
    email: 'u@oses.pk',
    role,
    fullName: 'User',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  localStorage.setItem('oses-auth', JSON.stringify({ user, token: 'tok' }));
}

function renderAt(path: string): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ClientProvider>
          <MemoryRouter initialEntries={[path]}>
            <React.Suspense fallback={<div>loading</div>}>
              <RouterConfig />
            </React.Suspense>
          </MemoryRouter>
        </ClientProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
});

// Route components are lazy-loaded, so the first paint of a page waits on its chunk.
// Under a full-suite run that can exceed findBy's 1s default.
const FIND = { timeout: 5000 };

describe('RouterConfig module composition', () => {
  it('mounts the shared exams module for ADMIN', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/exams/view');
    expect(await screen.findByRole('heading', { name: /exams/i }, FIND)).toBeInTheDocument();
  });

  it('mounts the same shared exams module for CONTROLLER', async () => {
    seed(UserRole.CONTROLLER);
    renderAt('/controller/exams/view');
    expect(await screen.findByRole('heading', { name: /exams/i }, FIND)).toBeInTheDocument();
  });

  it('mounts the shared students module for ADMIN', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/students/view');
    expect(await screen.findByRole('heading', { name: /students/i }, FIND)).toBeInTheDocument();
  });

  it('mounts the same shared students module for INSTITUTE', async () => {
    seed(UserRole.INSTITUTE);
    renderAt('/institute/students/view');
    expect(await screen.findByRole('heading', { name: /students/i }, FIND)).toBeInTheDocument();
  });

  it('resolves an admin-only module (setup / subjects)', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/subjects');
    expect(await screen.findByRole('heading', { name: /subjects/i }, FIND)).toBeInTheDocument();
  });

  it('redirects a module index path to its view child', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/exams');
    expect(await screen.findByRole('heading', { name: /exams/i }, FIND)).toBeInTheDocument();
  });

  it('falls through to the in-layout 404 for an unknown child path', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/does-not-exist');
    expect(await screen.findByText(/not found/i, undefined, FIND)).toBeInTheDocument();
  });
});
