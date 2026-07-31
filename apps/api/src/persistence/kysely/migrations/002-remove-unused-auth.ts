import { type Kysely, sql } from 'kysely';

/**
 * Phase-1 cleanup: drop the tables and columns that were created as scaffolding in `001`
 * but which no Phase-1 code uses — the onboarding/recovery/MFA tables and the two MFA
 * columns on `users`. They can be reintroduced by a future migration when email invitations,
 * self-service password reset, or MFA are actually built.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('mfa_recovery_codes').ifExists().execute();
  await db.schema.dropTable('password_reset_tokens').ifExists().execute();
  await db.schema.dropTable('user_invitations').ifExists().execute();

  await db.schema.alterTable('users').dropColumn('mfa_enabled').execute();
  await db.schema.alterTable('users').dropColumn('mfa_secret_enc').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('mfa_enabled', 'boolean', (c) => c.notNull().defaultTo(false))
    .execute();
  await db.schema.alterTable('users').addColumn('mfa_secret_enc', 'text').execute();

  await db.schema
    .createTable('user_invitations')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('email', sql`citext`, (c) => c.notNull())
    .addColumn('role_id', 'text', (c) => c.notNull())
    .addColumn('institute_id', 'text')
    .addColumn('token_hash', 'text', (c) => c.notNull().unique())
    .addColumn('invited_by', 'uuid')
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .addColumn('accepted_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addForeignKeyConstraint('invitations_role_fk', ['role_id'], 'roles', ['id'])
    .addForeignKeyConstraint('invitations_invited_by_fk', ['invited_by'], 'users', ['id'])
    .execute();
  await db.schema
    .createIndex('user_invitations_email_idx')
    .on('user_invitations')
    .column('email')
    .execute();

  await db.schema
    .createTable('password_reset_tokens')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (c) => c.notNull())
    .addColumn('token_hash', 'text', (c) => c.notNull().unique())
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .addColumn('used_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addForeignKeyConstraint('reset_user_fk', ['user_id'], 'users', ['id'], (cb) =>
      cb.onDelete('cascade'),
    )
    .execute();
  await db.schema
    .createIndex('password_reset_user_idx')
    .on('password_reset_tokens')
    .column('user_id')
    .execute();

  await db.schema
    .createTable('mfa_recovery_codes')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (c) => c.notNull())
    .addColumn('code_hash', 'text', (c) => c.notNull())
    .addColumn('used_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addForeignKeyConstraint('mfa_recovery_user_fk', ['user_id'], 'users', ['id'], (cb) =>
      cb.onDelete('cascade'),
    )
    .execute();
  await db.schema
    .createIndex('mfa_recovery_user_idx')
    .on('mfa_recovery_codes')
    .column('user_id')
    .execute();
}
