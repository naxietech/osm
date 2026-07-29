import { Inject, Injectable } from '@nestjs/common';

import type { PermissionAction, PermissionGrant, PermissionScope } from '@oses/types';

import { GRANTS_REPOSITORY, type GrantsRepository } from '../ports';

/**
 * Resolves a role's permission grants, cached per role id. Roles are seeded and static
 * in this phase, so the cache never needs invalidating; `clear()` exists for when
 * dynamic RBAC (runtime grant edits) lands.
 */
@Injectable()
export class PermissionResolver {
  private readonly cache = new Map<string, PermissionGrant[]>();

  constructor(@Inject(GRANTS_REPOSITORY) private readonly grantsRepo: GrantsRepository) {}

  async grantsFor(roleId: string): Promise<PermissionGrant[]> {
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

  /** The scope ('all' | 'own-institute') the role holds an action at, or undefined if ungranted. */
  async scopeFor(roleId: string, action: PermissionAction): Promise<PermissionScope | undefined> {
    return (await this.grantsFor(roleId)).find((g) => g.action === action)?.scope;
  }

  clear(): void {
    this.cache.clear();
  }
}
