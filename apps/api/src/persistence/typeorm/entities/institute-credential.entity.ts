import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * `institute_registration_credentials` — the password an institute chooses on the public form,
 * held until approval turns it into a real user account.
 *
 * **Why this is its own table rather than a column on `institutes`.** A password hash on the
 * institute row would sit inside every record the list, detail and mapper code reads. One
 * forgotten field in one mapper and a hash is in an API response, and the only thing preventing
 * that is nobody ever making a mistake. Here, the institute repository has no reason to join
 * this table, so it cannot leak by accident — the same reasoning that gave Module 1 two
 * controllers instead of one branching on whether the caller is logged in.
 *
 * The row is short-lived by design: it is written when a public registration arrives, read once
 * inside the approval transaction, and deleted in that same transaction. A rejection deletes it
 * without ever reading it. An institute entered by an admin never has one — the super admin sets
 * that account's password through the normal user-creation path.
 *
 * The hash is argon2id, produced by the shared `hashPassword` helper, so nothing readable is
 * ever stored even while the application is waiting.
 */
@Entity({ name: 'institute_registration_credentials' })
export class InstituteCredentialEntity {
  @PrimaryColumn({ name: 'institute_id', type: 'uuid' })
  instituteId!: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
