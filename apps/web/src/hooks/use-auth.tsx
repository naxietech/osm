/**
 * Auth state. The server owns the session — it lives in HttpOnly cookies the browser
 * sends automatically and JavaScript cannot read — so there is nothing to persist here.
 * On mount we ask `GET /auth/me` who we are; that answer is the session.
 *
 * `isLoading` is real and it matters: while `/auth/me` is in flight we do not yet know
 * whether the user is signed in, and ProtectedRoute has to wait rather than assume "no"
 * and bounce a signed-in user to the login page on every refresh.
 *
 * The check is skipped on public routes. A signed-out visitor on the login page has no
 * session to look up, and asking anyway would 401 — which the api client answers by
 * attempting a token renewal, so one pointless question becomes two.
 *
 * The login page is the one exception, and only when the browser carries the session marker
 * the API leaves readable. Without that exception a signed-in user who opens `/login` — a
 * bookmark, a second tab, the back button — sits looking at a sign-in form they do not need,
 * because `isAuthenticated` can only ever read false on a route we never check. The marker
 * keeps the cost where it belongs: visitors who have signed in here before pay one request,
 * everyone else still pays none.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LoginRequest, SafeUser } from '@oses/types';

import { clearSessionHint, hasSessionHint } from '@/lib/session-hint';
import { ROUTES, isPublicRoute } from '@/router/routes';
import { ApiError, onSessionExpired } from '@/services/api-client';
import { authService } from '@/services/auth.service';

export const AUTH_ME_KEY = ['auth', 'me'] as const;

/**
 * Identity of the session query, for "drop everything except this one".
 *
 * Sweeping by key *prefix* is what let the permission grants (`['auth', 'permissions']`)
 * survive a sign-out. Sweeping *everything* instead removes the session query mid-flight,
 * which makes its observer refetch, fail, and clear again — a loop. So: keep exactly the
 * session query, drop the rest, and let a new key be swept by default rather than spared.
 */
const AUTH_ME_KEY_ID = JSON.stringify(AUTH_ME_KEY);

function isNotSessionQuery(queryKey: readonly unknown[]): boolean {
  return JSON.stringify(queryKey) !== AUTH_ME_KEY_ID;
}

interface AuthContextValue {
  user: SafeUser | null;
  isAuthenticated: boolean;
  /** True until we know whether there is a session. */
  isLoading: boolean;
  /** True when the session could not be determined at all — not the same as signed out. */
  sessionError: boolean;
  /** Ask the server again after a `sessionError`. */
  retrySession: () => void;
  login: (credentials: LoginRequest) => Promise<SafeUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  sessionError: false,
  retrySession: () => undefined,
  login: () => Promise.reject(new Error('AuthProvider is missing')),
  logout: () => undefined,
});

/**
 * "Not signed in" is a normal answer, not a failure — turn the 401 into `null` so the
 * login page isn't sitting on a query stuck in an error state. Anything else (server
 * down, offline) still throws.
 *
 * A 401 that reaches here is final: the api client has already tried to renew and replayed the
 * request, so there is no session to be had — the moment to drop the marker, which otherwise
 * outlives its session and charges the login page a 401 plus a renewal on every later visit.
 *
 * `clearSession` below drops it too, and today that always fires on this path (the 401 goes
 * through renewal first, and a failed renewal announces the session as expired). Stated here
 * anyway: this is the one place that knows the answer directly, rather than inheriting it from
 * a side effect two files away that a change to `NO_RENEWAL_PATHS` would quietly remove.
 */
async function fetchSession(): Promise<SafeUser | null> {
  try {
    return await authService.me();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearSessionHint();
      return null;
    }
    // eslint-disable-next-line no-console -- an unexplained mass sign-out needs a trace
    console.error('Could not determine the session', error);
    throw error;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  // Checked once per render rather than held in state: a cookie can be cleared by the server
  // (logout) or by hand, and a remembered `true` would keep asking for a session long gone.
  const needsSession = !isPublicRoute(pathname) || (pathname === ROUTES.login && hasSessionHint());

  const {
    data: user,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: fetchSession,
    enabled: needsSession,
    // One retry absorbs a deploy blip or a dropped packet. A 401 is not an error here
    // (fetchSession turns it into null), so this only ever retries a real failure.
    retry: 1,
    staleTime: Infinity,
  });

  /**
   * Mark the session signed-out and drop every other cached query — the permission
   * grants above all. They are cached with `staleTime: Infinity`, so if they outlive a
   * sign-out the next user on this tab inherits them, `students.viewPII` included.
   */
  const clearSession = useCallback((): void => {
    queryClient.setQueryData(AUTH_ME_KEY, null);
    queryClient.removeQueries({ predicate: (q) => isNotSessionQuery(q.queryKey) });
    // The API clears the marker itself on a clean sign-out. This covers the paths where it
    // never got the chance: a sign-out request that failed, or a session the client gave up
    // renewing. Both leave a marker pointing at nothing.
    clearSessionHint();
  }, [queryClient]);

  // The api client renews expired sessions on its own, so this fires only when renewal
  // failed and the session is genuinely over. Clearing the user is enough — ProtectedRoute
  // sends them to the login page from there.
  useEffect(() => onSessionExpired(clearSession), [clearSession]);

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginRequest) => authService.login(credentials),
    onSuccess: (signedIn) => {
      // Same reason as clearSession: whoever used this tab before must leave nothing
      // behind, and their grants are the dangerous part.
      queryClient.setQueryData(AUTH_ME_KEY, signedIn);
      queryClient.removeQueries({ predicate: (q) => isNotSessionQuery(q.queryKey) });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onError: (error) => {
      // The local session is cleared regardless (see onSettled), but the server may not
      // have revoked the cookies — worth a trace, because on a shared machine the next
      // person could still be holding a live session.
      // eslint-disable-next-line no-console -- diagnosing a failed sign-out matters
      console.error(
        'Sign-out request failed; cleared locally but cookies may still be live',
        error,
      );
    },
    // Clear either way. If the call failed the cookies may still be live, but leaving the
    // user signed in on a screen they asked to leave is the worse outcome.
    onSettled: clearSession,
  });

  // `useMutation` returns a fresh object every render, so depending on the whole thing
  // would defeat the memo below and re-render every `useAuth()` consumer in the app on
  // each navigation. The individual methods are stable.
  const { mutateAsync: runLogin } = loginMutation;
  const { mutate: runLogout } = logoutMutation;

  const login = useCallback(
    (credentials: LoginRequest): Promise<SafeUser> => runLogin(credentials),
    [runLogin],
  );

  const logout = useCallback((): void => runLogout(), [runLogout]);

  const retrySession = useCallback((): void => {
    void refetch();
  }, [refetch]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      isAuthenticated: Boolean(user),
      // A disabled query reports as pending forever, so fold in whether we are even
      // asking — otherwise the login page would sit behind a spinner that never ends.
      isLoading: needsSession && isPending,
      // A 401 means "signed out" and is handled above. Reaching here means we could not
      // find out — server down, offline, unreadable response. Treating that as "signed
      // out" would silently boot every open tab to the login page during an outage.
      sessionError: needsSession && isError,
      retrySession,
      login,
      logout,
    }),
    [user, needsSession, isPending, isError, retrySession, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
