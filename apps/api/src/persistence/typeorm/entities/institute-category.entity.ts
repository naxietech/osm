import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { InstituteCategoryQuestionEntity } from './institute-category-question.entity';

/**
 * `institute_categories` — the super-admin taxonomy institutes are classified by (School,
 * College, Board, …). `code` is a case-insensitive `citext` unique column, editable because
 * nothing references a category by code — every link uses `id`.
 *
 * `version` is an optimistic-lock counter incremented on every mutation: a writer submits the
 * version it loaded and the update only applies while it still matches, so a second concurrent
 * save is rejected instead of silently overwriting the first.
 *
 * **One global taxonomy, deliberately not client-scoped.** The absence of a `client_id` column is
 * a Phase 1 decision — every client shares one category list — not an oversight predating
 * multi-client support. If per-client taxonomies are ever needed, add `client_id` and widen the
 * unique index from `(code)` to `(client_id, code)`; both tables are small, so that migration is
 * seconds rather than the hours it would take on a student-sized table.
 */
@Entity({ name: 'institute_categories' })
export class InstituteCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'citext' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

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

  @OneToMany(() => InstituteCategoryQuestionEntity, (question) => question.category)
  questions!: InstituteCategoryQuestionEntity[];
}
