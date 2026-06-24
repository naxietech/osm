import { type ReactElement, type ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { type SafeUser, UserRole } from '@oses/types';

import { AuthProvider, useAuth } from './use-auth';

const ADMIN: SafeUser = {
  id: 'u1',
  email: 'admin@oses.pk',
  role: UserRole.ADMIN,
  fullName: 'Board Admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function Wrapper({ children }: { children: ReactNode }): ReactElement {
  return <AuthProvider>{children}</AuthProvider>;
}

afterEach(() => {
  localStorage.clear();
});

describe('AuthProvider', () => {
  it('starts logged out', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('login sets the user and persists to localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    act(() => result.current.login(ADMIN, 'tok-123'));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('admin@oses.pk');
    expect(localStorage.getItem('oses-auth')).toContain('tok-123');
  });

  it('logout clears the user and storage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    act(() => result.current.login(ADMIN, 'tok-123'));
    act(() => result.current.logout());
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('oses-auth')).toBeNull();
  });

  it('restores a valid persisted session on mount', () => {
    localStorage.setItem('oses-auth', JSON.stringify({ user: ADMIN, token: 'tok-123' }));
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.role).toBe(UserRole.ADMIN);
  });

  it('discards a persisted session whose role is unknown', () => {
    localStorage.setItem(
      'oses-auth',
      JSON.stringify({ user: { ...ADMIN, role: 'SUPER_ADMIN' }, token: 'tok-123' }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    expect(result.current.isAuthenticated).toBe(false);
  });
});
