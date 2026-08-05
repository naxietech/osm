import { Column, Entity, PrimaryColumn } from 'typeorm';

import type { PermissionScope } from '@oses/types';

/**
 * `role_grants` — which actions a role holds, and at what scope. Composite primary key
 * (role_id, permission_id); `scope` is DB-check-constrained to 'all' | 'own-institute'.
 *
 * Both columns are uuids now. The repository joins back to `permissions.action` when reading, so
 * callers still receive `{ action, scope }` and nothing above the persistence layer changed.
 */
@Entity({ name: 'role_grants' })
export class RoleGrantEntity {
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @PrimaryColumn({ name: 'permission_id', type: 'uuid' })
  permissionId!: string;

  @Column({ type: 'text' })
  scope!: PermissionScope;
}
