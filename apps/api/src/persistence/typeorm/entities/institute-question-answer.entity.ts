import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { InstituteCategoryQuestionEntity } from './institute-category-question.entity';
import { InstituteEntity } from './institute.entity';

/**
 * `institute_question_answers` — one row per question an institute answered when it registered.
 *
 * A row rather than an element in a jsonb array, because the link to the question has to be
 * something the database can protect. `questionId` is a real foreign key with `ON DELETE
 * RESTRICT`, so an answered question cannot be deleted out from under its answers — the rule
 * Module 1 was built around and could not enforce until this table existed.
 *
 * `values` is an array because the answer type decides the shape: `text` and `file` store one
 * element, `radio` and `select` store the one option chosen, `checkbox` stores several. Keeping
 * a single column means the reader never has to know which type it is asking about.
 */
@Entity({ name: 'institute_question_answers' })
export class InstituteQuestionAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'institute_id', type: 'uuid' })
  instituteId!: string;

  @Column({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  @Column({ type: 'text', array: true, default: () => `'{}'` })
  values!: string[];

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => InstituteEntity, (institute) => institute.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'institute_id' })
  institute!: InstituteEntity;

  @ManyToOne(() => InstituteCategoryQuestionEntity)
  @JoinColumn({ name: 'question_id' })
  question!: InstituteCategoryQuestionEntity;
}
