import type { SafeUser } from '@oses/types';

import { legacyRoleFor } from '../rbac/legacy-role';
import type { AuthUserRecord, UserStatus } from './ports';

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

/**
 * The richer shape for the admin user directory: SafeUser plus account-management
 * fields (status, last login). Still never carries password_hash or other secrets.
 */
export interface AdminUser extends SafeUser {
  status: UserStatus;
  lastLoginAt: string | null;
}

export function toAdminUser(user: AuthUserRecord): AdminUser {
  return {
    ...toSafeUser(user),
    status: user.status,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}
