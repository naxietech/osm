import { Entity, PrimaryColumn } from 'typeorm';

/**
 * `permissions` — the catalogue of valid permission actions. FK target for `role_grants`
 * so a grant can never name an action outside the @oses/types PermissionAction union.
 */
@Entity({ name: 'permissions' })
export class PermissionEntity {
  @PrimaryColumn({ type: 'text' })
  action!: string;
}
