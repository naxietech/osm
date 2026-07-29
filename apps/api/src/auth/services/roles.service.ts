import { Inject, Injectable } from '@nestjs/common';

import type { Role } from '@oses/types';

import { ROLE_REPOSITORY, type RoleRepository } from '../ports';

/** Read access to the role catalogue (the 5 seeded system roles + their grants). */
@Injectable()
export class RolesService {
  constructor(@Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository) {}

  async listRoles(): Promise<Role[]> {
    const rows = await this.roles.listWithGrants();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      isSystem: r.isSystem,
      instituteId: r.instituteId ?? undefined,
      grants: r.grants,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
