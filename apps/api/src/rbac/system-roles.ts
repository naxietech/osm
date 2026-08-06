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

/**
 * Stable role ids — referenced by `users.role_id`, carried in the access token, and compared
 * against in the guards.
 *
 * These are **fixed** uuids rather than generated ones, which is what lets this stay a
 * compile-time constant: a guard can say `roleId === SYSTEM_ROLE_IDS.superAdmin` with no
 * database lookup. Roles created later (custom roles) get a generated `uuidv7()` instead — they
 * are looked up by `code`, since by definition there is no constant to compare them to.
 *
 * They are genuine uuid v7 values, minted once by `uuidv7()` and pasted here — not hand-written
 * placeholders. All five share one millisecond prefix and increment in the tail, so they sort in
 * role order and index as tightly as any other v7 key. Readability is not lost by making them
 * opaque: `roles.code` (`super_admin`, `admin`, …) is the human-facing key.
 */
export const SYSTEM_ROLE_IDS = {
  superAdmin: '019fc9fe-9756-7829-86f1-fc4c79b7ab36',
  admin: '019fc9fe-9756-7849-bb20-8c3c8213b4c5',
  controller: '019fc9fe-9756-7851-8368-55cd6e8d7874',
  checker: '019fc9fe-9756-7856-ae6a-ae9b60217577', // display name: "Evaluator"
  institute: '019fc9fe-9756-785b-925d-8ab3063888b0',
} as const;

/** The readable key for each system role — `roles.code`, unique, and safe to show in a UI. */
export const SYSTEM_ROLE_CODES = {
  superAdmin: 'super_admin',
  admin: 'admin',
  controller: 'controller',
  checker: 'checker',
  institute: 'institute',
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
  'checkers.manage',
  'checkers.approve', // checker approval is a Super Admin AND Admin action (domain-rules.md)
  'exams.manage',
  'exams.assignRolls',
  'templates.manage',
  'registrations.manage',
  'results.viewAll',
  'dashboard.view',
];

/** Controller Examiner: sets up exams and oversees marking. */
const CONTROLLER_EXAMINER_ACTIONS: PermissionAction[] = [
  'exams.manage',
  'exams.assignRolls',
  'templates.manage',
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

/**
 * Whether a role may be bound to an institute.
 *
 * This is not cosmetic. `assertOwnInstitute` and PermissionsGuard both treat any caller
 * carrying an `instituteId` as institute-bound and refuse them everything outside it — so
 * binding a global role to one institute silently cripples that account, with no screen to
 * undo it. Reject the combination rather than store a contradiction.
 *
 * Institute — required: its grants are all `own-institute`, meaningless without one.
 * Evaluator — allowed: an institute makes them a school-specific checker, and leaving it
 *   off makes them a general checker who marks across the board (see checker.types.ts).
 * Everyone else — forbidden: Super Admin, Admin and Controller are global by design.
 */
export function roleAcceptsInstitute(roleId: string): boolean {
  if (roleId === SYSTEM_ROLE_IDS.checker) return true;
  const role = SYSTEM_ROLES.find((r) => r.id === roleId);
  return Boolean(role?.grants.some((g) => g.scope === 'own-institute'));
}

export interface SystemRoleSeed {
  id: string;
  code: string;
  name: string;
  grants: PermissionGrant[];
}

export const SYSTEM_ROLES: SystemRoleSeed[] = [
  {
    id: SYSTEM_ROLE_IDS.superAdmin,
    code: SYSTEM_ROLE_CODES.superAdmin,
    name: 'Super Admin',
    grants: grants('all', ALL_ADMIN_ACTIONS),
  },
  {
    id: SYSTEM_ROLE_IDS.admin,
    code: SYSTEM_ROLE_CODES.admin,
    name: 'Admin',
    grants: grants('all', ADMIN_ACTIONS),
  },
  {
    id: SYSTEM_ROLE_IDS.controller,
    code: SYSTEM_ROLE_CODES.controller,
    name: 'Controller Examiner',
    grants: grants('all', CONTROLLER_EXAMINER_ACTIONS),
  },
  {
    id: SYSTEM_ROLE_IDS.checker,
    code: SYSTEM_ROLE_CODES.checker,
    name: 'Evaluator',
    grants: grants('all', EVALUATOR_ACTIONS),
  },
  {
    id: SYSTEM_ROLE_IDS.institute,
    code: SYSTEM_ROLE_CODES.institute,
    name: 'Institute',
    grants: grants('own-institute', INSTITUTE_ACTIONS),
  },
];
