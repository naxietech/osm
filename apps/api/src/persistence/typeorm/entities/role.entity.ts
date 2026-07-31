import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * `roles` — RBAC roles. `id` is a stable slug (e.g. 'role_super_admin') matching
 * @oses/types Role.id, so it is a natural (non-generated) primary key.
 */
@Entity({ name: 'roles' })
export class RoleEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'institute_id', type: 'text', nullable: true })
  instituteId!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
