import { type PermissionAction, type PermissionScope } from '@oses/types';

import { resolveRoleForUser } from '@/services/roles.service';

import { useAuth } from './use-auth';

/**
 * Data-driven permissions. Resolves the current user's Role (see roles.service) and
 * exposes `can(action)` / `scopeFor(action)` over its grants. The boolean getters are
 * thin wrappers kept so existing callers keep working while the app migrates to
 * permission-based gating.
 */
interface UsePermissionsReturn {
  /** True if the current role grants this action (at any scope). */
  can: (action: PermissionAction) => boolean;
  /** The scope of the granted action (`all` | `own-institute`), or null if not granted. */
  scopeFor: (action: PermissionAction) => PermissionScope | null;

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
  /** Register students as exam candidates. */
  canRegisterCandidates: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth();
  const role = resolveRoleForUser(user);
  const grants = role?.grants ?? [];

  const can = (action: PermissionAction): boolean => grants.some((g) => g.action === action);
  const scopeFor = (action: PermissionAction): PermissionScope | null =>
    grants.find((g) => g.action === action)?.scope ?? null;

  return {
    can,
    scopeFor,
    canViewPII: can('students.viewPII'),
    canMark: can('marking.mark'),
    canSuperviseMarking: can('marking.supervise'),
    canManageSchools: can('institutes.manage'),
    canManageStudents: can('students.manage'),
    canViewAllResults: can('results.viewAll'),
    canViewOwnSchoolResults: can('results.viewOwn'),
    canManageExams: can('exams.manage'),
    canRegisterCandidates: can('registrations.manage'),
  };
}
