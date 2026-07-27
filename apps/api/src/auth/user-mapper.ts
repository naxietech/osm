import type { SafeUser } from '@oses/types';

import { legacyRoleFor } from '../rbac/legacy-role';
import type { AuthUserRecord } from './ports';

/** Map an internal user record to the PII-safe shape returned to clients. */
export function toSafeUser(user: AuthUserRecord): SafeUser {
  return {
    id: user.id,
    email: user.email,
    role: legacyRoleFor(user.roleId),
    roleId: user.roleId,
    instituteId: user.instituteId ?? undefined,
    fullName: user.fullName,
    createdAt: user.createdAt.toISOString(),
  };
}
