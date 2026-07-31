import { useCallback, useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { type PermissionAction, type PermissionScope } from '@oses/types';

import { authService } from '@/services/auth.service';

import { useAuth } from './use-auth';

export const AUTH_PERMISSIONS_KEY = ['auth', 'permissions'] as const;

/**
 * Data-driven permissions, read from `GET /auth/permissions` — the server is the
 * authority on what a user may do, and the same grants back the API's own guards.
 * Fetched once per session (roles cannot change while signed in) and cached.
 *
 * `can(action)` / `scopeFor(action)` are the real surface; the boolean getters are thin
 * wrappers kept so existing callers keep working while the app migrates to
 * permission-based gating.
 *
 * Until the grants arrive every check answers false — withholding is the safe default,
 * and ProtectedRoute waits on `isLoading` so no screen renders before we know.
 */
interface UsePermissionsReturn {
  /** True if the current role grants this action (at any scope). */
  can: (action: PermissionAction) => boolean;
  /** The scope of the granted action (`all` | `own-institute`), or null if not granted. */
  scopeFor: (action: PermissionAction) => PermissionScope | null;
  /** True while the grants are still being fetched. */
  isLoading: boolean;
  /**
   * True when the grants could not be loaded. Distinct from "this role holds nothing":
   * every `can()` also answers false here, so a caller that ignores this renders a
   * fully-permissioned user as having no rights at all.
   */
  isError: boolean;
  /** Ask the server again after an `isError`. */
  retryPermissions: () => void;

  // ---- legacy boolean getters (wrappers over can()) ----
  /** Super Admin / Admin / Controller Examiner can see student PII; evaluators never can. */
  canViewPII: boolean;
  /** Evaluator (paper checker) role can submit marks. */
  canMark: boolean;
  /** Controller Examiner can supervise/resolve marking. */
  canSuperviseMarking: boolean;
  /** Manage institutes (super admin). */
  canManageSchools: boolean;
  /** Manage students (super admin, or institute for its own). */
  canManageStudents: boolean;
  /** View results across all institutes. */
  canViewAllResults: boolean;
  /** View results for the user's own institute only. */
  canViewOwnSchoolResults: boolean;
  /** Create/edit exams and assign roll numbers. */
  canManageExams: boolean;
  /** Create/edit/delete e-sheet templates (super admin, admin, controller examiner). */
  canManageTemplates: boolean;
  /** Register students as exam candidates. */
  canRegisterCandidates: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { isAuthenticated, isLoading: sessionLoading } = useAuth();

  const {
    data: grants,
    isLoading: grantsLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: AUTH_PERMISSIONS_KEY,
    queryFn: () => authService.permissions(),
    enabled: isAuthenticated,
    staleTime: Infinity,
    retry: 1,
  });

  if (isError) {
    // Without this the only symptom is an app where every capability answers false — a
    // fully-permissioned admin looking like they have no rights at all, with nothing
    // anywhere to point at the real cause.
    // eslint-disable-next-line no-console -- otherwise this failure is invisible
    console.error('Could not load permission grants', error);
  }

  const retryPermissions = useCallback((): void => {
    void refetch();
  }, [refetch]);

  return useMemo<UsePermissionsReturn>(() => {
    const list = grants ?? [];
    const can = (action: PermissionAction): boolean => list.some((g) => g.action === action);
    const scopeFor = (action: PermissionAction): PermissionScope | null =>
      list.find((g) => g.action === action)?.scope ?? null;

    return {
      can,
      scopeFor,
      // The grants query is disabled until the session is known, and a disabled query
      // does not report as loading. Without folding the session load in, `isLoading`
      // would read false during that first window and callers would treat "no grants
      // yet" as "denied".
      isLoading: sessionLoading || grantsLoading,
      isError,
      retryPermissions,
      canViewPII: can('students.viewPII'),
      canMark: can('marking.mark'),
      canSuperviseMarking: can('marking.supervise'),
      canManageSchools: can('institutes.manage'),
      canManageStudents: can('students.manage'),
      canViewAllResults: can('results.viewAll'),
      canViewOwnSchoolResults: can('results.viewOwn'),
      canManageExams: can('exams.manage'),
      canManageTemplates: can('templates.manage'),
      canRegisterCandidates: can('registrations.manage'),
    };
  }, [grants, sessionLoading, grantsLoading, isError, retryPermissions]);
}
