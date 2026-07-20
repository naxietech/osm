/**
 * Mock roles/permissions service (frontend only) — the data-driven RBAC store.
 *
 * Seeds the TRD's five system roles:
 *   Super Admin        — full access (everything except personally marking).
 *   Admin              — limited back-office: institutes / students / exams data.
 *                        NO roles, permissions, clients, or reference data (categories,
 *                        subjects, classes, SLOs).
 *   Controller Examiner— creates/manages exams; supervises marking.
 *   Evaluator          — marks scripts (paper checker).
 *   Institute          — manages/registers its OWN students (own-institute scope).
 *
 * The super admin can create/edit custom roles on top; this store is mutable so those
 * flows can push in. `SYSTEM_ROLE_IDS` keys are legacy (checker/controller) but the
 * display names now follow the TRD (Evaluator / Controller Examiner) — ids stay stable.
 *
 * `PERMISSION_CATALOG` describes every action for the role editor: its module grouping,
 * a human label, and whether the `own-institute` scope is meaningful for it.
 *
 * TODO: replace with a real rolesApi + super-admin Roles/Users management screens.
 */
import {
  type CreateRoleDto,
  type PermissionAction,
  type PermissionGrant,
  type PermissionScope,
  type Role,
  type SafeUser,
  type UpdateRoleDto,
  UserRole,
} from '@oses/types';

// ---- permission catalog (drives the role editor UI) ----
export interface PermissionMeta {
  action: PermissionAction;
  module: string; // grouping header in the editor
  label: string; // human description
  scopeable: boolean; // can this action be limited to own-institute?
}

export const PERMISSION_CATALOG: PermissionMeta[] = [
  { action: 'clients.manage', module: 'Platform', label: 'Manage clients', scopeable: false },
  { action: 'roles.manage', module: 'Platform', label: 'Manage roles', scopeable: true },
  { action: 'users.manage', module: 'Platform', label: 'Manage users', scopeable: true },
  {
    action: 'institutes.manage',
    module: 'Institutes',
    label: 'Manage institutes',
    scopeable: false,
  },
  {
    action: 'institute-categories.manage',
    module: 'Institutes',
    label: 'Manage institute categories',
    scopeable: false,
  },
  { action: 'subjects.manage', module: 'Academic', label: 'Manage subjects', scopeable: false },
  {
    action: 'levels.manage',
    module: 'Academic',
    label: 'Manage classes / levels',
    scopeable: false,
  },
  {
    action: 'groups.manage',
    module: 'Academic',
    label: 'Manage groups / programs',
    scopeable: false,
  },
  { action: 'curriculum.manage', module: 'Academic', label: 'Manage curriculum', scopeable: false },
  { action: 'slos.manage', module: 'Academic', label: 'Manage SLOs', scopeable: false },
  { action: 'students.manage', module: 'Students', label: 'Manage students', scopeable: true },
  { action: 'students.viewPII', module: 'Students', label: 'View student PII', scopeable: true },
  { action: 'checkers.manage', module: 'Checkers', label: 'Add / edit checkers', scopeable: true },
  {
    action: 'checkers.approve',
    module: 'Checkers',
    label: 'Approve checker registrations',
    scopeable: false,
  },
  { action: 'exams.manage', module: 'Exams', label: 'Create / edit exams', scopeable: false },
  { action: 'exams.assignRolls', module: 'Exams', label: 'Assign roll numbers', scopeable: false },
  {
    action: 'registrations.manage',
    module: 'Registration',
    label: 'Register candidates',
    scopeable: true,
  },
  { action: 'marking.mark', module: 'Marking', label: 'Mark scripts', scopeable: false },
  { action: 'marking.supervise', module: 'Marking', label: 'Supervise marking', scopeable: false },
  { action: 'results.viewAll', module: 'Results', label: 'View all results', scopeable: false },
  {
    action: 'results.viewOwn',
    module: 'Results',
    label: 'View own-institute results',
    scopeable: false,
  },
  { action: 'dashboard.view', module: 'Dashboard', label: 'View dashboard', scopeable: false },
];

/** Every action a fully-privileged role holds — everything except personally marking. */
const ALL_ADMIN_ACTIONS: PermissionAction[] = PERMISSION_CATALOG.map((p) => p.action).filter(
  (a) => a !== 'marking.mark' && a !== 'results.viewOwn',
);

/**
 * Limited back-office (Admin): operational data only. Explicitly excludes roles,
 * permissions, clients, and all reference data (categories / subjects / classes / SLOs).
 */
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

function grants(scope: PermissionScope, actions: PermissionAction[]): PermissionGrant[] {
  return actions.map((action) => ({ action, scope }));
}

// ---- stable system role ids (keys are legacy; display names follow the TRD) ----
export const SYSTEM_ROLE_IDS = {
  superAdmin: 'role_super_admin',
  admin: 'role_admin',
  institute: 'role_institute',
  checker: 'role_checker', // display name: "Evaluator"
  controller: 'role_controller', // display name: "Controller Examiner"
} as const;

const SEEDED_AT = '2026-01-01T00:00:00.000Z';

/** Mutable roles store — the five TRD system roles (super admin adds custom roles later). */
export const roles: Role[] = [
  {
    id: SYSTEM_ROLE_IDS.superAdmin,
    name: 'Super Admin',
    isSystem: true,
    grants: grants('all', ALL_ADMIN_ACTIONS),
    createdAt: SEEDED_AT,
  },
  {
    id: SYSTEM_ROLE_IDS.admin,
    name: 'Admin',
    isSystem: true,
    grants: grants('all', ADMIN_ACTIONS),
    createdAt: SEEDED_AT,
  },
  {
    id: SYSTEM_ROLE_IDS.controller,
    name: 'Controller Examiner',
    isSystem: true,
    grants: grants('all', CONTROLLER_EXAMINER_ACTIONS),
    createdAt: SEEDED_AT,
  },
  {
    id: SYSTEM_ROLE_IDS.checker,
    name: 'Evaluator',
    isSystem: true,
    grants: grants('all', ['marking.mark', 'dashboard.view']),
    createdAt: SEEDED_AT,
  },
  {
    id: SYSTEM_ROLE_IDS.institute,
    name: 'Institute',
    isSystem: true,
    grants: grants('own-institute', [
      'students.manage',
      'students.viewPII',
      'checkers.manage',
      'registrations.manage',
      'results.viewOwn',
      'dashboard.view',
    ]),
    createdAt: SEEDED_AT,
  },
];

export function listRoles(): Role[] {
  return roles;
}

export function getRole(id: string): Role | undefined {
  return roles.find((r) => r.id === id);
}

/** Transition map: legacy UserRole enum → seeded Role id (until users carry roleId). */
const ENUM_TO_ROLE_ID: Record<UserRole, string> = {
  [UserRole.ADMIN]: SYSTEM_ROLE_IDS.superAdmin,
  [UserRole.CONTROLLER]: SYSTEM_ROLE_IDS.controller,
  [UserRole.EVALUATOR]: SYSTEM_ROLE_IDS.checker,
  [UserRole.INSTITUTE]: SYSTEM_ROLE_IDS.institute,
};

/** Resolve the Role for a user — prefers the data-driven roleId, falls back to the enum. */
export function resolveRoleForUser(user: SafeUser | null | undefined): Role | undefined {
  if (!user) return undefined;
  const roleId = user.roleId ?? ENUM_TO_ROLE_ID[user.role];
  return getRole(roleId);
}

export function roleName(id: string | undefined): string {
  return (id && getRole(id)?.name) || '—';
}

// ---- mutations (super-admin Roles management) ----
let roleCounter = roles.length;

/** Create a custom role. `instituteId` tags it as owned by one institute. */
export function createRole(dto: CreateRoleDto): Role {
  roleCounter += 1;
  const role: Role = {
    id: `role_custom_${roleCounter}`,
    name: dto.name,
    isSystem: false,
    grants: dto.grants,
    createdAt: new Date().toISOString(),
    ...(dto.instituteId ? { instituteId: dto.instituteId } : {}),
  };
  roles.push(role);
  return role;
}

/** Update a custom role's name/grants. System roles are read-only (returns undefined). */
export function updateRole(id: string, dto: UpdateRoleDto): Role | undefined {
  const role = getRole(id);
  if (!role || role.isSystem) return undefined;
  if (dto.name !== undefined) role.name = dto.name;
  if (dto.grants !== undefined) role.grants = dto.grants;
  return role;
}

/** Delete a custom role. System roles cannot be deleted (returns false). */
export function deleteRole(id: string): boolean {
  const role = getRole(id);
  if (!role || role.isSystem) return false;
  roles.splice(roles.indexOf(role), 1);
  return true;
}
