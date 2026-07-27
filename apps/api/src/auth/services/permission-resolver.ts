import { Inject, Injectable } from '@nestjs/common';

import type { PermissionAction } from '@oses/types';

import { GRANTS_REPOSITORY, type GrantsRepository, type RoleGrant } from '../ports';

/**
 * Resolves a role's permission grants, cached per role id. Roles are seeded and static
 * in this phase, so the cache never needs invalidating; `clear()` exists for when
 * dynamic RBAC (runtime grant edits) lands.
 */
@Injectable()
export class PermissionResolver {
  private readonly cache = new Map<string, RoleGrant[]>();

  constructor(@Inject(GRANTS_REPOSITORY) private readonly grantsRepo: GrantsRepository) {}

  async grantsFor(roleId: string): Promise<RoleGrant[]> {
    const cached = this.cache.get(roleId);
    if (cached) return cached;
    const grants = await this.grantsRepo.listByRoleId(roleId);
    this.cache.set(roleId, grants);
    return grants;
  }

  /** True only if the role grants every one of the required actions. */
  async hasAll(roleId: string, actions: PermissionAction[]): Promise<boolean> {
    const granted = new Set((await this.grantsFor(roleId)).map((g) => g.action));
    return actions.every((action) => granted.has(action));
  }

  clear(): void {
    this.cache.clear();
  }
}
