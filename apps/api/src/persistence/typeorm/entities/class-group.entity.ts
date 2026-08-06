import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { ClassEntity } from './class.entity';

/**
 * `class_groups` — **both** groups and subgroups, at two depths of one table.
 *
 * They are the same thing twice over: a name, an on/off switch, and a parent. `parent_id`
 * null means a group; set means a subgroup of that group. A class with no groups (Class 1–8)
 * simply has no rows here — no flag to check, no empty list to reason about.
 *
 * `id` is what a student or exam row will point at once those tables exist, so it is assigned
 * once and **never regenerated**. A group is deactivated with `is_active = false`, never
 * deleted; there is no delete route anywhere in this module.
 *
 * The one rule the database cannot hold is that a subgroup must not have subgroups of its
 * own — a CHECK constraint cannot look at another row. The service enforces it, and there is
 * only one write path (the class tree save), which builds exactly two depths by construction.
 */
@Entity({ name: 'class_groups' })
export class ClassGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'class_id', type: 'uuid' })
  classId!: string;

  /** Null for a group; the owning group's id for a subgroup. Never two levels deep. */
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column({ type: 'citext' })
  name!: string;

  /**
   * Display position among its siblings — within the class for a group, within the group for a
   * subgroup. A real column because a whole tree is written in one statement, so `created_at`
   * cannot separate two rows and ordering would otherwise fall back to a random uuid.
   */
  @Column({ name: 'sort_order', type: 'smallint' })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => ClassEntity, (cls) => cls.groups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class!: ClassEntity;
}
