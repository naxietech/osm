import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * `subjects` — the national subject/course list (Physics, Urdu, …) that the curriculum, SLOs and
 * exam papers reference by `id`.
 *
 * `code` is a case-insensitive `citext` unique column, so `PHY` and `phy` cannot both exist. It
 * stays editable because nothing links to a subject by code — every reference uses `id`.
 *
 * There is no delete path: a subject is withdrawn by setting `is_active = false`, so anything
 * already pointing at it keeps resolving. `creditHours` is deliberately absent — nothing sets or
 * shows it yet, and a later migration adds the column when the university/GPA phase needs it.
 */
@Entity({ name: 'subjects' })
export class SubjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'citext' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /** Null for the seeded rows, which are planted before any admin exists to own them. */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;
}
