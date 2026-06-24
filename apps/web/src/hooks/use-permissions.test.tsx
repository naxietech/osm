import { type ReactElement, type ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { type SafeUser, UserRole } from '@oses/types';

import { AuthProvider, useAuth } from './use-auth';
import { usePermissions } from './use-permissions';

function makeUser(role: UserRole): SafeUser {
  return {
    id: 'u',
    email: 'u@oses.pk',
    role,
    fullName: 'User',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function Wrapper({ children }: { children: ReactNode }): ReactElement {
  return <AuthProvider>{children}</AuthProvider>;
}

afterEach(() => {
  localStorage.clear();
});

describe('usePermissions', () => {
  it('grants no permissions when logged out', () => {
    const { result } = renderHook(() => usePermissions(), { wrapper: Wrapper });
    expect(result.current.canManageSchools).toBe(false);
    expect(result.current.canMark).toBe(false);
  });

  it('admin can manage schools + view PII but cannot mark', () => {
    const { result } = renderHook(() => ({ auth: useAuth(), perms: usePermissions() }), {
      wrapper: Wrapper,
    });
    act(() => result.current.auth.login(makeUser(UserRole.ADMIN), 'tok'));
    expect(result.current.perms.canManageSchools).toBe(true);
    expect(result.current.perms.canViewPII).toBe(true);
    expect(result.current.perms.canMark).toBe(false);
  });

  it('evaluator can mark but cannot manage schools or view PII', () => {
    const { result } = renderHook(() => ({ auth: useAuth(), perms: usePermissions() }), {
      wrapper: Wrapper,
    });
    act(() => result.current.auth.login(makeUser(UserRole.EVALUATOR), 'tok'));
    expect(result.current.perms.canMark).toBe(true);
    expect(result.current.perms.canManageSchools).toBe(false);
    expect(result.current.perms.canViewPII).toBe(false);
  });

  it('school staff can only view its own school results', () => {
    const { result } = renderHook(() => ({ auth: useAuth(), perms: usePermissions() }), {
      wrapper: Wrapper,
    });
    act(() => result.current.auth.login(makeUser(UserRole.SCHOOL_STAFF), 'tok'));
    expect(result.current.perms.canViewOwnSchoolResults).toBe(true);
    expect(result.current.perms.canViewAllResults).toBe(false);
  });
});
