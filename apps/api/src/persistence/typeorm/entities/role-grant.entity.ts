import { Column, Entity, PrimaryColumn } from 'typeorm';

import type { PermissionScope } from '@oses/types';

/**
 * `role_grants` — action + scope granted to a role. Composite primary key (role_id, action);
 * `scope` is DB-check-constrained to 'all' | 'own-institute'.
 */
@Entity({ name: 'role_grants' })
export class RoleGrantEntity {
  @PrimaryColumn({ name: 'role_id', type: 'text' })
  roleId!: string;

  @PrimaryColumn({ type: 'text' })
  action!: string;

  @Column({ type: 'text' })
  scope!: PermissionScope;
}
