import { UserRole } from '@oses/types';

import { SYSTEM_ROLE_IDS } from './system-roles';

/**
 * Best-effort map from a data-driven role id to the legacy `UserRole` enum, for the
 * token's `role` claim and `SafeUser.role`. The enum has no SUPER_ADMIN, so Super Admin
 * maps to ADMIN (matching the web's existing convention). This is NON-authoritative —
 * fine-grained authorization resolves grants from `roleId`, not this value. Revisit when
 * the enum gains SUPER_ADMIN (see the auth plan's open items).
 */
const ROLE_ID_TO_ENUM: Record<string, UserRole> = {
  [SYSTEM_ROLE_IDS.superAdmin]: UserRole.ADMIN,
  [SYSTEM_ROLE_IDS.admin]: UserRole.ADMIN,
  [SYSTEM_ROLE_IDS.controller]: UserRole.CONTROLLER,
  [SYSTEM_ROLE_IDS.checker]: UserRole.EVALUATOR,
  [SYSTEM_ROLE_IDS.institute]: UserRole.INSTITUTE,
};

export function legacyRoleFor(roleId: string): UserRole {
  return ROLE_ID_TO_ENUM[roleId] ?? UserRole.INSTITUTE;
}
