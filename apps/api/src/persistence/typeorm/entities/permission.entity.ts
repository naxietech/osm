import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * `permissions` — the catalogue of valid permission actions.
 *
 * `action` is still the value code names (`@RequirePermissions('users.manage')`) and is still
 * unique, but it is no longer the primary key: `role_grants` points at `id` instead. That means
 * renaming an action touches one row rather than every grant referencing it, and leaves room for
 * `label`/`groupName` — what a permissions-management screen needs to render something better
 * than a raw dotted string.
 */
@Entity({ name: 'permissions' })
export class PermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  action!: string;

  /** Human wording for a UI, e.g. "Manage users". Null until a screen needs it. */
  @Column({ type: 'text', nullable: true })
  label!: string | null;

  /** Grouping for a UI, e.g. "User management". Null until a screen needs it. */
  @Column({ name: 'group_name', type: 'text', nullable: true })
  groupName!: string | null;
}
