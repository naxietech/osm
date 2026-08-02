import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import type { CategoryQuestionType } from '@oses/types';

import { InstituteCategoryEntity } from './institute-category.entity';

/**
 * `institute_category_questions` — one row per dynamic question on a category.
 *
 * `id` is the anchor every institute's stored answer points at, so it is assigned once and
 * **never regenerated**; display position lives in the separate `sort_order` column. A question
 * that already has answers is retired via `is_active = false` rather than deleted, so historic
 * answers keep resolving to the question that was actually asked.
 */
@Entity({ name: 'institute_category_questions' })
export class InstituteCategoryQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'text' })
  type!: CategoryQuestionType;

  @Column({ type: 'boolean', default: false })
  required!: boolean;

  /** Choice list for radio/checkbox/select; always `[]` for text/file (DB-check-constrained). */
  @Column({ type: 'jsonb' })
  options!: string[];

  @Column({ name: 'sort_order', type: 'integer' })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => InstituteCategoryEntity, (category) => category.questions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category!: InstituteCategoryEntity;
}
