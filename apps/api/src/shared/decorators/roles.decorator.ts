import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'required_roles';

/**
 * Restrict a route to specific role ids (the data-driven role slugs, e.g.
 * `SYSTEM_ROLE_IDS.superAdmin`). Keyed off roleId — not the legacy UserRole enum —
 * so it can distinguish Super Admin from Admin.
 */
export const Roles = (...roleIds: string[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roleIds);
