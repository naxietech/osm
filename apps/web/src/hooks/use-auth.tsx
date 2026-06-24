/**
 * Auth state — holds the logged-in user + token, persisted in localStorage so the
 * session survives a refresh. Populated by the mock authService on login.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { type SafeUser, UserRole } from '@oses/types';

interface AuthState {
  user: SafeUser | null;
  token: string | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: SafeUser, token: string) => void;
  logout: () => void;
}

const STORAGE_KEY = 'oses-auth';

function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && (Object.values(UserRole) as string[]).includes(role);
}

function readStoredAuth(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AuthState>;
      // Discard if the stored role is no longer a known role (e.g. left over from
      // an earlier role set) so a stale session can't crash the app.
      if (parsed.user && parsed.token && isValidRole(parsed.user.role)) {
        return { user: parsed.user, token: parsed.token };
      }
    }
  } catch {
    /* corrupt or blocked storage — treat as logged out */
  }
  return { user: null, token: null };
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  login: () => undefined,
  logout: () => undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [state, setState] = useState<AuthState>(readStoredAuth);

  const login = useCallback((user: SafeUser, token: string): void => {
    setState({ user, token });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback((): void => {
    setState({ user: null, token: null });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      token: state.token,
      isAuthenticated: Boolean(state.token && state.user),
      isLoading: false,
      login,
      logout,
    }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
