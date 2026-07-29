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
    // Unreachable with the seeded system roles. Rather than SILENTLY stamping a guessed role
    // onto a security-relevant token claim (which the web routes off), fail loud: the login
    // /refresh throws and surfaces as a 500, so an unmapped role is fixed, not shipped.
    logger.error(`Unmapped roleId "${roleId}" — refusing to issue a token with a guessed role.`);
    throw new Error(`Unmapped roleId: ${roleId}`);
  }
  return mapped;
}
