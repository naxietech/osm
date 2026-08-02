import { type ReactElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type PermissionAction,
  type PermissionGrant,
  type PermissionScope,
  type SafeUser,
  UserRole,
} from '@oses/types';

import { mockAuthApi, mockAuthSession } from '@/test-utils/api-mock';

import { AuthProvider, useAuth } from './use-auth';
import { usePermissions } from './use-permissions';

const USER: SafeUser = {
  id: 'u',
  email: 'u@oses.pk',
  role: UserRole.ADMIN,
  roleId: 'role_admin',
  fullName: 'User',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function grants(scope: PermissionScope, actions: PermissionAction[]): PermissionGrant[] {
  return actions.map((action) => ({ action, scope }));
}

function makeWrapper(): ({ children }: { children: ReactNode }) => ReactElement {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin']}>
          <AuthProvider>{children}</AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

/** Render the hook signed in with the given grants and wait for them to arrive. */
async function signedInWith(
  permissions: PermissionGrant[],
): Promise<{ current: ReturnType<typeof usePermissions> }> {
  mockAuthApi({ me: USER, permissions });
  const { result } = renderHook(() => usePermissions(), { wrapper: makeWrapper() });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usePermissions', () => {
  it('grants nothing when signed out', async () => {
    mockAuthApi({ me: null });
    const { result } = renderHook(() => usePermissions(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canManageSchools).toBe(false);
    expect(result.current.canMark).toBe(false);
  });

  it('withholds every permission until the grants arrive', async () => {
    // Withholding is the safe default — an evaluator must never see candidate PII in the
    // gap before the server has said what they may do.
    mockAuthApi({ me: USER, permissions: grants('all', ['students.viewPII']) });
    const { result } = renderHook(() => usePermissions(), { wrapper: makeWrapper() });

    expect(result.current.canViewPII).toBe(false);
    await waitFor(() => expect(result.current.canViewPII).toBe(true));
  });

  it('exposes can() over the grants the server returned', async () => {
    const result = await signedInWith(grants('all', ['roles.manage', 'institutes.manage']));
    expect(result.current.can('roles.manage')).toBe(true);
    expect(result.current.can('institutes.manage')).toBe(true);
    expect(result.current.can('marking.mark')).toBe(false);
  });

  it('maps the legacy boolean getters onto the grants', async () => {
    const result = await signedInWith(
      grants('all', ['institutes.manage', 'students.viewPII', 'results.viewAll']),
    );
    expect(result.current.canManageSchools).toBe(true);
    expect(result.current.canViewPII).toBe(true);
    expect(result.current.canViewAllResults).toBe(true);
    expect(result.current.canMark).toBe(false);
  });

  it('reports an evaluator as able to mark but never to view PII', async () => {
    const result = await signedInWith(grants('all', ['marking.mark', 'dashboard.view']));
    expect(result.current.canMark).toBe(true);
    expect(result.current.canViewPII).toBe(false);
    expect(result.current.canManageSchools).toBe(false);
  });

  it('reports the scope a grant was given at', async () => {
    const result = await signedInWith(grants('own-institute', ['students.manage']));
    expect(result.current.scopeFor('students.manage')).toBe('own-institute');
    expect(result.current.scopeFor('exams.manage')).toBeNull(); // not granted
  });

  it('does not carry one user’s grants into the next session on the same tab', async () => {
    // Shared institute / exam-centre workstation: an Admin signs out and an Evaluator
    // signs in without ever reloading the page. The grants are cached under an
    // ['auth', …] key with staleTime Infinity, so nothing refetches them unless signing
    // out explicitly drops the entry. If it doesn't, the Evaluator inherits the Admin's
    // grants — including students.viewPII, which they must never hold.
    const api = mockAuthSession();
    const admin: SafeUser = { ...USER, id: 'admin', email: 'admin@oses.pk' };
    const evaluator: SafeUser = {
      ...USER,
      id: 'evaluator',
      email: 'evaluator@oses.pk',
      role: UserRole.EVALUATOR,
      roleId: 'role_checker',
    };

    api.signIn(admin, grants('all', ['students.viewPII', 'institutes.manage']));

    const { result } = renderHook(() => ({ auth: useAuth(), perms: usePermissions() }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.perms.canViewPII).toBe(true));

    result.current.auth.logout();
    await waitFor(() => expect(result.current.auth.isAuthenticated).toBe(false));

    api.signIn(evaluator, grants('all', ['marking.mark', 'dashboard.view']));
    await result.current.auth.login({ email: 'evaluator@oses.pk', password: 'secret123' });
    await waitFor(() => expect(result.current.auth.isAuthenticated).toBe(true));

    await waitFor(() => expect(result.current.perms.canMark).toBe(true));
    expect(result.current.perms.canViewPII).toBe(false);
    expect(result.current.perms.canManageSchools).toBe(false);
  });
});
