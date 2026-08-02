/**
 * Roles API — read-only.
 *
 * The server owns roles and their grants (`apps/api/src/rbac/system-roles.ts` seeds the
 * five TRD roles). `GET /roles` is the only endpoint: there is no create, update or
 * delete, so the Roles screens show what exists and nothing more.
 *
 * BACKEND GAP: custom roles were designed for (`CreateRoleDto`/`UpdateRoleDto` exist in
 * @oses/types, and the role editor was built against the old mock) but the API has no
 * write routes yet. The editing UI stays hidden until POST/PATCH/DELETE /roles land.
 *
 * `PERMISSION_CATALOG` stays local: it is UI text — module grouping, human labels, and
 * which actions are scopeable — not data. @oses/types deliberately keeps it out of the
 * shared package so that package stays type-only.
 */
import type { PermissionAction, Role } from '@oses/types';

import { apiRequest } from './api-client';
import { API_ENDPOINTS } from './api-endpoints';

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
    action: 'templates.manage',
    module: 'E-Sheet',
    label: 'Create / edit e-sheet templates',
    scopeable: false,
  },
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

// ---- stable system role ids (keys are legacy; display names follow the TRD) ----
// These mirror the ids seeded by apps/api/src/rbac/system-roles.ts and are stable.
export const SYSTEM_ROLE_IDS = {
  superAdmin: 'role_super_admin',
  admin: 'role_admin',
  institute: 'role_institute',
  checker: 'role_checker', // display name: "Evaluator"
  controller: 'role_controller', // display name: "Controller Examiner"
} as const;

/** Every role with its grants. Read-only — the API has no role-write routes. */
function listRoles(): Promise<Role[]> {
  return apiRequest<Role[]>(API_ENDPOINTS.roles.list);
}

export const rolesService = { listRoles };
