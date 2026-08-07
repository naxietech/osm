import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import type { InstituteStatus, InstitutionType, Province, RegistrationSource } from '@oses/types';

import { InstituteQuestionAnswerEntity } from './institute-question-answer.entity';

/**
 * `institutes` — the root of the data tree. Students belong to an institute, exams to students,
 * marks to exams, results to marks; every design choice here is inherited by rows that do not
 * exist yet.
 *
 * Two codes, and they do different jobs. `instituteCode` is the government's own (`S01`) —
 * whatever they were issued, typed in by them, and the thing a human recognises. `numericCode` is
 * ours: a plain integer from a sequence, assigned at approval, used to build student registration
 * numbers and to block roll numbers per institute. The government code cannot do that job — it
 * has letters, varies in length, and is not ours to guarantee.
 *
 * `numericCode` is null while an institute is still pending; a check constraint makes it
 * mandatory from `approved` onwards.
 */
@Entity({ name: 'institutes' })
export class InstituteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'institute_code', type: 'citext' })
  instituteCode!: string;

  @Column({ name: 'numeric_code', type: 'integer', nullable: true })
  numericCode!: number | null;

  @Column({ name: 'institute_name', type: 'text' })
  instituteName!: string;

  @Column({ type: 'text', nullable: true })
  branch!: string | null;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @Column({ name: 'institution_type', type: 'text' })
  institutionType!: InstitutionType;

  @Column({ type: 'text' })
  address!: string;

  @Column({ type: 'text' })
  city!: string;

  @Column({ type: 'text' })
  province!: Province;

  @Column({ name: 'postal_code', type: 'text', nullable: true })
  postalCode!: string | null;

  @Column({ name: 'contact_person_name', type: 'text' })
  contactPersonName!: string;

  @Column({ name: 'contact_person_designation', type: 'text' })
  contactPersonDesignation!: string;

  @Column({ name: 'contact_email', type: 'citext' })
  contactEmail!: string;

  @Column({ name: 'contact_phone', type: 'text' })
  contactPhone!: string;

  @Column({ type: 'text' })
  status!: InstituteStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ name: 'registration_source', type: 'text' })
  registrationSource!: RegistrationSource;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy!: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Soft delete, allowed only while nothing is attached — no students, no exams, no users. That
   * covers the real case (approved by mistake, or a duplicate) without letting anyone remove an
   * institute that results depend on. The row stays for the audit trail, but the code is freed:
   * the live-uniqueness index skips deleted rows, so the institute can be registered again.
   */
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  /**
   * Who removed it. The row is kept precisely so the record survives, and a record that cannot
   * say who ended it is not much of one — every other state change here names its actor.
   */
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy!: string | null;

  @OneToMany(() => InstituteQuestionAnswerEntity, (answer) => answer.institute)
  answers!: InstituteQuestionAnswerEntity[];
}
