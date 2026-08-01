import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * `auth_audit_log` — append-only audit trail. `id` is a bigint identity (the pg driver
 * returns it as a string). `metadata` is jsonb with a DB default of '{}'.
 */
@Entity({ name: 'auth_audit_log' })
export class AuthAuditLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'text' })
  event!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'text', nullable: true })
  ip!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'jsonb' })
  metadata!: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
