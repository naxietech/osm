import { Logger } from '@nestjs/common';

import { UserRole } from '@oses/types';

import { SYSTEM_ROLE_IDS } from './system-roles';

const logger = new Logger('legacyRoleFor');

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
  const mapped = ROLE_ID_TO_ENUM[roleId];
  if (!mapped) {
    // Unreachable with the seeded system roles, but a custom/dynamic roleId would land here.
    // Fall back to the least-privileged label and make the gap visible rather than silent.
    logger.error(`Unmapped roleId "${roleId}" — falling back to UserRole.INSTITUTE.`);
    return UserRole.INSTITUTE;
  }
  return mapped;
}
