import type { PermissionAction, PermissionGrant, PermissionScope } from '@oses/types';

import { ALL_PERMISSION_ACTIONS } from './permissions.constants';

/**
 * The five TRD system roles and their grants — the backend source of truth for the
 * RBAC seed. Mirrors `apps/web/src/services/roles.service.ts` (the mock the frontend
 * uses today); ids and grant sets are kept identical so the real API is drop-in.
 *
 * TODO: once the backend owns RBAC, unify this seed into @oses/types so web + api
 * share one definition instead of mirroring.
 */

/** Stable role ids — referenced by users.role_id and @oses/types Role.id. */
export const SYSTEM_ROLE_IDS = {
  superAdmin: 'role_super_admin',
  admin: 'role_admin',
  controller: 'role_controller',
  checker: 'role_checker', // display name: "Evaluator"
  institute: 'role_institute',
} as const;

/**
 * Fully-privileged role holds every action except the two that are role-specific by design:
 * `marking.mark` (personally marking scripts) and `results.viewOwn` (own-institute-only result view).
 */
const ALL_ADMIN_ACTIONS: PermissionAction[] = ALL_PERMISSION_ACTIONS.filter(
  (a) => a !== 'marking.mark' && a !== 'results.viewOwn',
);

/** Admin (limited back-office): operational data only — no roles/clients/reference data. */
const ADMIN_ACTIONS: PermissionAction[] = [
  'institutes.manage',
  'students.manage',
  'students.viewPII',
  'exams.manage',
  'exams.assignRolls',
  'registrations.manage',
  'results.viewAll',
  'dashboard.view',
];

/** Controller Examiner: sets up exams and oversees marking. */
const CONTROLLER_EXAMINER_ACTIONS: PermissionAction[] = [
  'exams.manage',
  'exams.assignRolls',
  'students.viewPII',
  'marking.supervise',
  'results.viewAll',
  'dashboard.view',
];

/** Evaluator (paper checker): marks scripts, sees a dashboard — and no PII. */
const EVALUATOR_ACTIONS: PermissionAction[] = ['marking.mark', 'dashboard.view'];

/** Institute: manages its OWN students/registrations — every grant is own-institute scoped. */
const INSTITUTE_ACTIONS: PermissionAction[] = [
  'students.manage',
  'students.viewPII',
  'checkers.manage',
  'registrations.manage',
  'results.viewOwn',
  'dashboard.view',
];

function grants(scope: PermissionScope, actions: PermissionAction[]): PermissionGrant[] {
  return actions.map((action) => ({ action, scope }));
}

export interface SystemRoleSeed {
  id: string;
  name: string;
  grants: PermissionGrant[];
}

export const SYSTEM_ROLES: SystemRoleSeed[] = [
  { id: SYSTEM_ROLE_IDS.superAdmin, name: 'Super Admin', grants: grants('all', ALL_ADMIN_ACTIONS) },
  { id: SYSTEM_ROLE_IDS.admin, name: 'Admin', grants: grants('all', ADMIN_ACTIONS) },
  {
    id: SYSTEM_ROLE_IDS.controller,
    name: 'Controller Examiner',
    grants: grants('all', CONTROLLER_EXAMINER_ACTIONS),
  },
  { id: SYSTEM_ROLE_IDS.checker, name: 'Evaluator', grants: grants('all', EVALUATOR_ACTIONS) },
  {
    id: SYSTEM_ROLE_IDS.institute,
    name: 'Institute',
    grants: grants('own-institute', INSTITUTE_ACTIONS),
  },
];
