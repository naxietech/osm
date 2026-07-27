import { type Kysely, sql } from 'kysely';

/**
 * Initial auth schema: RBAC (roles + permission catalogue + action/scope grants),
 * users, sessions (refresh rotation), append-only audit log, and the onboarding /
 * recovery token tables. Contract-aligned with @oses/types (Role, PermissionGrant).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`create extension if not exists citext`.execute(db);

  // ---- RBAC ----
  await db.schema
    .createTable('roles')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('is_system', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('institute_id', 'text')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('permissions')
    .addColumn('action', 'text', (c) => c.primaryKey())
    .execute();

  await db.schema
    .createTable('role_grants')
    .addColumn('role_id', 'text', (c) => c.notNull())
    .addColumn('action', 'text', (c) => c.notNull())
    .addColumn('scope', 'text', (c) => c.notNull())
    .addPrimaryKeyConstraint('role_grants_pk', ['role_id', 'action'])
    .addForeignKeyConstraint('role_grants_role_fk', ['role_id'], 'roles', ['id'], (cb) =>
      cb.onDelete('cascade'),
    )
    .addForeignKeyConstraint('role_grants_action_fk', ['action'], 'permissions', ['action'])
    .addCheckConstraint('role_grants_scope_chk', sql`scope in ('all', 'own-institute')`)
    .execute();

  // ---- users ----
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('email', sql`citext`, (c) => c.notNull().unique())
    .addColumn('password_hash', 'text')
    .addColumn('role_id', 'text', (c) => c.notNull())
    .addColumn('institute_id', 'text')
    .addColumn('full_name', 'text', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('pending'))
    .addColumn('mfa_enabled', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('mfa_secret_enc', 'text')
    .addColumn('failed_login_count', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('locked_until', 'timestamptz')
    .addColumn('last_login_at', 'timestamptz')
    .addColumn('password_changed_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('created_by', 'uuid')
    .addForeignKeyConstraint('users_role_fk', ['role_id'], 'roles', ['id'])
    .addForeignKeyConstraint('users_created_by_fk', ['created_by'], 'users', ['id'])
    .addCheckConstraint(
      'users_status_chk',
      sql`status in ('pending', 'active', 'suspended', 'locked')`,
    )
    .execute();

  await db.schema.createIndex('users_institute_idx').on('users').column('institute_id').execute();
  await db.schema.createIndex('users_role_idx').on('users').column('role_id').execute();

  // ---- sessions (refresh rotation + reuse detection) ----
  await db.schema
    .createTable('sessions')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (c) => c.notNull())
    .addColumn('refresh_hash', 'text', (c) => c.notNull())
    .addColumn('family_id', 'uuid', (c) => c.notNull())
    .addColumn('issued_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .addColumn('rotated_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('revoked_reason', 'text')
    .addColumn('replaced_by', 'uuid')
    .addColumn('ip', 'text')
    .addColumn('user_agent', 'text')
    .addForeignKeyConstraint('sessions_user_fk', ['user_id'], 'users', ['id'], (cb) =>
      cb.onDelete('cascade'),
    )
    .execute();

  await db.schema.createIndex('sessions_user_idx').on('sessions').column('user_id').execute();
  await db.schema.createIndex('sessions_family_idx').on('sessions').column('family_id').execute();
  await db.schema
    .createIndex('sessions_refresh_hash_uq')
    .on('sessions')
    .column('refresh_hash')
    .unique()
    .execute();

  // ---- append-only audit log ----
  await db.schema
    .createTable('auth_audit_log')
    .addColumn('id', 'bigint', (c) => c.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('event', 'text', (c) => c.notNull())
    .addColumn('actor_id', 'uuid')
    .addColumn('user_id', 'uuid')
    .addColumn('ip', 'text')
    .addColumn('user_agent', 'text')
    .addColumn('metadata', 'jsonb', (c) => c.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('auth_audit_user_idx')
    .on('auth_audit_log')
    .columns(['user_id', 'created_at'])
    .execute();
  await db.schema
    .createIndex('auth_audit_event_idx')
    .on('auth_audit_log')
    .columns(['event', 'created_at'])
    .execute();

  // ---- onboarding & recovery tokens (all stored hashed) ----
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

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('mfa_recovery_codes').ifExists().execute();
  await db.schema.dropTable('password_reset_tokens').ifExists().execute();
  await db.schema.dropTable('user_invitations').ifExists().execute();
  await db.schema.dropTable('auth_audit_log').ifExists().execute();
  await db.schema.dropTable('sessions').ifExists().execute();
  await db.schema.dropTable('users').ifExists().execute();
  await db.schema.dropTable('role_grants').ifExists().execute();
  await db.schema.dropTable('permissions').ifExists().execute();
  await db.schema.dropTable('roles').ifExists().execute();
}
