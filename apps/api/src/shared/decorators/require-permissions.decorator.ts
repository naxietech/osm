import { SetMetadata } from '@nestjs/common';

import type { PermissionAction } from '@oses/types';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Require the caller's role to grant every listed permission action. Enforced by
 * PermissionsGuard (which must run after JwtAuthGuard). This is the primary, TRD-aligned
 * authorization mechanism — prefer it over role checks for capabilities (e.g. viewing PII).
 */
export const RequirePermissions = (
  ...actions: PermissionAction[]
): ReturnType<typeof SetMetadata> => SetMetadata(PERMISSIONS_KEY, actions);
