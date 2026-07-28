import { UserRole } from '@oses/types';

import { SYSTEM_ROLE_IDS } from './system-roles';

/**
 * Map from a data-driven role id to the legacy `UserRole` enum, for the token's `role`
 * claim and `SafeUser.role`. Now a 1:1 mapping — the enum carries all five roles. This
 * remains NON-authoritative: fine-grained authorization resolves grants from `roleId`,
 * not this coarse label.
 */
const ROLE_ID_TO_ENUM: Record<string, UserRole> = {
  [SYSTEM_ROLE_IDS.superAdmin]: UserRole.SUPER_ADMIN,
  [SYSTEM_ROLE_IDS.admin]: UserRole.ADMIN,
  [SYSTEM_ROLE_IDS.controller]: UserRole.CONTROLLER,
  [SYSTEM_ROLE_IDS.checker]: UserRole.EVALUATOR,
  [SYSTEM_ROLE_IDS.institute]: UserRole.INSTITUTE,
};

export function legacyRoleFor(roleId: string): UserRole {
  return ROLE_ID_TO_ENUM[roleId] ?? UserRole.INSTITUTE;
}
