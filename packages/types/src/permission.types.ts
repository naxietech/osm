/**
 * RBAC — data-driven roles & permissions (replaces the fixed UserRole matrix).
 *
 * A Role is a named set of PermissionGrants. Each grant pairs an action with a
 * scope: `all` (across every institute) or `own-institute` (limited to the user's
 * own institute). System roles (Super Admin, Institute, Checker) are seeded and
 * cannot be deleted; the super admin can create additional roles, and a role tagged
 * with an `instituteId` is a custom role owned by (and usable only within) that
 * institute.
 *
 * The action strings are namespaced `module.action`. The runtime catalog that drives
 * the role editor (labels, module grouping, which actions are scopeable) lives in the
 * web app (services/roles.service) so this package stays type-only.
 */

/** A capability, namespaced `module.action`. */
export type PermissionAction =
  | 'clients.manage'
  | 'roles.manage'
  | 'users.manage'
  | 'institutes.manage'
  | 'institute-categories.manage'
  | 'subjects.manage'
  | 'levels.manage'
  | 'groups.manage'
  | 'curriculum.manage'
  | 'slos.manage'
  | 'students.manage'
  | 'students.viewPII'
  | 'checkers.manage'
  | 'checkers.approve'
  | 'exams.manage'
  | 'exams.assignRolls'
  | 'registrations.manage'
  | 'marking.mark'
  | 'marking.supervise'
  | 'results.viewAll'
  | 'results.viewOwn'
  | 'dashboard.view';

/** How wide a granted action reaches. */
export type PermissionScope = 'all' | 'own-institute';

export interface PermissionGrant {
  action: PermissionAction;
  scope: PermissionScope;
}

export interface Role {
  id: string;
  name: string; // 'Super Admin', 'Institute', 'Checker', or a custom name
  isSystem: boolean; // seeded defaults — cannot be deleted
  instituteId?: string; // set = custom role OWNED BY one institute; unset = global
  grants: PermissionGrant[];
  createdAt: string;
}

export interface CreateRoleDto {
  name: string;
  instituteId?: string;
  grants: PermissionGrant[];
}

export interface UpdateRoleDto {
  name?: string;
  grants?: PermissionGrant[];
}
