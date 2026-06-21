import { UserRole } from '@oses/types';

import { useAuth } from './use-auth';

interface UsePermissionsReturn {
  /** Admin and Controller can see student PII (name, CNIC, DOB) */
  canViewPII: boolean;
  /** Evaluator role can submit marks */
  canMark: boolean;
  /** Only Admin can create, update, or deactivate schools */
  canManageSchools: boolean;
  /** Only Admin can enrol or transfer students */
  canManageStudents: boolean;
  /** Admin and Controller can view results across all schools */
  canViewAllResults: boolean;
  /** School Staff can view results for their own school only */
  canViewOwnSchoolResults: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth();
  const role = user.role;

  return {
    canViewPII: role === UserRole.ADMIN || role === UserRole.CONTROLLER,
    canMark: role === UserRole.EVALUATOR,
    canManageSchools: role === UserRole.ADMIN,
    canManageStudents: role === UserRole.ADMIN,
    canViewAllResults: role === UserRole.ADMIN || role === UserRole.CONTROLLER,
    canViewOwnSchoolResults: role === UserRole.SCHOOL_STAFF,
  };
}
