import type { PermissionAction } from '@oses/types';

/**
 * The full set of permission actions, seeded into the `permissions` catalogue table.
 *
 * Declared as a `Record<PermissionAction, true>` so the compiler forces every action
 * in the @oses/types union to appear here — add an action to the type and this file
 * fails to build until it's listed. The human labels / module grouping / scopeability
 * live in the web app's PERMISSION_CATALOG (per the @oses/types contract), not here.
 */
const ACTION_PRESENCE: Record<PermissionAction, true> = {
  'clients.manage': true,
  'roles.manage': true,
  'users.manage': true,
  'institutes.manage': true,
  'institute-categories.manage': true,
  'subjects.manage': true,
  'levels.manage': true,
  'groups.manage': true,
  'curriculum.manage': true,
  'slos.manage': true,
  'students.manage': true,
  'students.viewPII': true,
  'checkers.manage': true,
  'checkers.approve': true,
  'exams.manage': true,
  'exams.assignRolls': true,
  'templates.manage': true,
  'registrations.manage': true,
  'marking.mark': true,
  'marking.supervise': true,
  'results.viewAll': true,
  'results.viewOwn': true,
  'dashboard.view': true,
};

export const ALL_PERMISSION_ACTIONS = Object.keys(ACTION_PRESENCE) as PermissionAction[];
