import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * `roles` — RBAC roles.
 *
 * `id` is a uuid; the five seeded system roles carry fixed ones (see `SYSTEM_ROLE_IDS`) so the
 * guards can compare against a constant, while custom roles get `uuidv7()` from the database.
 * `code` is the readable key that used to *be* the id (`super_admin`, `admin`, …) — still
 * unique, and now free to be shown or renamed without rewriting every row that points at it.
 *
 * Not `@PrimaryGeneratedColumn('uuid')`: the seed supplies its own ids for the system roles, and
 * the DB default (`uuidv7()`) covers everything else.
 */
@Entity({ name: 'roles' })
export class RoleEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'institute_id', type: 'text', nullable: true })
  instituteId!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
