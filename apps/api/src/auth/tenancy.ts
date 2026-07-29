import { ForbiddenException } from '@nestjs/common';

import type { AuthPrincipal } from './principal';

/**
 * Record-level tenant check for the load-first case — where the target institute is only
 * known after loading the record, so PermissionsGuard (which runs before the handler) can't
 * enforce it. Call this in the service right after loading the resource.
 *
 * An institute-bound caller (has `instituteId`) may only touch records in that same
 * institute; a global caller (no institute binding — Super Admin / Admin / Controller) is
 * unrestricted. This is the same rule the guard applies for request-level targets.
 */
export function assertOwnInstitute(caller: AuthPrincipal, targetInstituteId: string | null): void {
  if (caller.instituteId && caller.instituteId !== targetInstituteId) {
    throw new ForbiddenException('Cross-institute access is not allowed');
  }
}
