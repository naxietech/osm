import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import type { UserStatus } from '../../../auth/ports';

/**
 * `users` — accounts + login/lockout state. `email` is a case-insensitive `citext` unique
 * column. `created_at` / `updated_at` carry DB `now()` defaults, so they are left unset on
 * insert and written explicitly on mutation (mirroring the previous data layer exactly).
 */
@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'citext' })
  email!: string;

  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'role_id', type: 'text' })
  roleId!: string;

  @Column({ name: 'institute_id', type: 'text', nullable: true })
  instituteId!: string | null;

  @Column({ name: 'full_name', type: 'text' })
  fullName!: string;

  @Column({ type: 'text' })
  status!: UserStatus;

  @Column({ name: 'failed_login_count', type: 'integer', default: 0 })
  failedLoginCount!: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil!: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: 'password_changed_at', type: 'timestamptz', nullable: true })
  passwordChangedAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;
}
