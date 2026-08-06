import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { ClassGroupEntity } from './class-group.entity';

/**
 * `classes` — the top of the Class → Group → Subgroup hierarchy (Class 9, Class 10, …).
 *
 * `ordinal` is a real column rather than something derived from the name: sorted
 * alphabetically "Class 10" comes before "Class 9", which is wrong in every screen that
 * lists classes in progression order.
 *
 * `name` is `citext`, so "class 9" and "Class 9" collide on the unique index instead of
 * quietly becoming two classes.
 *
 * `version` is an optimistic-lock counter incremented on every mutation. It matters more here
 * than elsewhere: a class write can carry the whole group tree, and a tree save deactivates
 * any stored row the payload does not mention. Without the counter, a second admin saving a
 * copy loaded before the first admin's save would silently switch off a group that had just
 * been added — data loss with no error anywhere.
 *
 * **One global class list, deliberately not client-scoped**, matching `institute_categories`.
 * If per-client classes are ever needed, add `client_id` and widen the unique index from
 * `(name)` to `(client_id, name)`; the table is tiny, so that migration is seconds.
 */
@Entity({ name: 'classes' })
export class ClassEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'citext' })
  name!: string;

  @Column({ type: 'smallint' })
  ordinal!: number;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @OneToMany(() => ClassGroupEntity, (group) => group.class)
  groups!: ClassGroupEntity[];
}
