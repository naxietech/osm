import { UserRole } from '@oses/types';

import { useAuth } from './use-auth';

/**
 * Provisional role permissions for the 4 roles. Admin has the most; the rest are
 * limited. The exact matrix is intentionally rough for now and will be refined.
 */
interface UsePermissionsReturn {
  /** Admin and Controller can see student PII (name, CNIC, DOB). Evaluators never can. */
  canViewPII: boolean;
  /** Evaluator role can submit marks. */
  canMark: boolean;
  /** Admin and Controller can supervise/resolve marking. */
  canSuperviseMarking: boolean;
  /** Only Admin can create, update, or deactivate schools. */
  canManageSchools: boolean;
  /** Admin and School Staff can enrol students. */
  canManageStudents: boolean;
  /** Admin and Controller can view results across all schools. */
  canViewAllResults: boolean;
  /** School Staff can view results for its own school only. */
  canViewOwnSchoolResults: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === UserRole.ADMIN;
  const isController = role === UserRole.CONTROLLER;

  return {
    canViewPII: isAdmin || isController,
    canMark: role === UserRole.EVALUATOR,
    canSuperviseMarking: isAdmin || isController,
    canManageSchools: isAdmin,
    canManageStudents: isAdmin || role === UserRole.SCHOOL_STAFF,
    canViewAllResults: isAdmin || isController,
    canViewOwnSchoolResults: role === UserRole.SCHOOL_STAFF,
  };
}
