import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline auth schema for the TypeORM data layer. Reproduces the exact live schema that the
 * previous (Kysely) migrations `001` + `002` converged on — the six auth tables with no MFA
 * columns or onboarding/recovery token tables — so the physical database is unchanged. Column
 * names, types, defaults, indexes, FKs, and check constraints are byte-for-byte identical.
 */
export class InitialAuthSchema1730000000000 implements MigrationInterface {
  name = 'InitialAuthSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`create extension if not exists citext`);

    // ---- RBAC ----
    await queryRunner.query(`
      create table "roles" (
        "id" text primary key,
        "name" text not null,
        "is_system" boolean not null default false,
        "institute_id" text,
        "created_at" timestamptz not null default now()
      )
    `);

    await queryRunner.query(`
      create table "permissions" (
        "action" text primary key
      )
    `);

    await queryRunner.query(`
      create table "role_grants" (
        "role_id" text not null,
        "action" text not null,
        "scope" text not null,
        constraint "role_grants_pk" primary key ("role_id", "action"),
        constraint "role_grants_role_fk" foreign key ("role_id") references "roles" ("id") on delete cascade,
        constraint "role_grants_action_fk" foreign key ("action") references "permissions" ("action"),
        constraint "role_grants_scope_chk" check ("scope" in ('all', 'own-institute'))
      )
    `);

    // ---- users ----
    await queryRunner.query(`
      create table "users" (
        "id" uuid primary key default gen_random_uuid(),
        "email" citext not null unique,
        "password_hash" text,
        "role_id" text not null,
        "institute_id" text,
        "full_name" text not null,
        "status" text not null default 'pending',
        "failed_login_count" integer not null default 0,
        "locked_until" timestamptz,
        "last_login_at" timestamptz,
        "password_changed_at" timestamptz,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "created_by" uuid,
        constraint "users_role_fk" foreign key ("role_id") references "roles" ("id"),
        constraint "users_created_by_fk" foreign key ("created_by") references "users" ("id"),
        constraint "users_status_chk" check ("status" in ('pending', 'active', 'suspended', 'locked'))
      )
    `);
    await queryRunner.query(`create index "users_institute_idx" on "users" ("institute_id")`);
    await queryRunner.query(`create index "users_role_idx" on "users" ("role_id")`);

    // ---- sessions (refresh rotation + reuse detection) ----
    await queryRunner.query(`
      create table "sessions" (
        "id" uuid primary key default gen_random_uuid(),
        "user_id" uuid not null,
        "refresh_hash" text not null,
        "family_id" uuid not null,
        "issued_at" timestamptz not null default now(),
        "expires_at" timestamptz not null,
        "rotated_at" timestamptz,
        "revoked_at" timestamptz,
        "revoked_reason" text,
        "replaced_by" uuid,
        "ip" text,
        "user_agent" text,
        constraint "sessions_user_fk" foreign key ("user_id") references "users" ("id") on delete cascade
      )
    `);
    await queryRunner.query(`create index "sessions_user_idx" on "sessions" ("user_id")`);
    await queryRunner.query(`create index "sessions_family_idx" on "sessions" ("family_id")`);
    await queryRunner.query(
      `create unique index "sessions_refresh_hash_uq" on "sessions" ("refresh_hash")`,
    );

    // ---- append-only audit log ----
    await queryRunner.query(`
      create table "auth_audit_log" (
        "id" bigint generated always as identity primary key,
        "event" text not null,
        "actor_id" uuid,
        "user_id" uuid,
        "ip" text,
        "user_agent" text,
        "metadata" jsonb not null default '{}'::jsonb,
        "created_at" timestamptz not null default now()
      )
    `);
    await queryRunner.query(
      `create index "auth_audit_user_idx" on "auth_audit_log" ("user_id", "created_at")`,
    );
    await queryRunner.query(
      `create index "auth_audit_event_idx" on "auth_audit_log" ("event", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists "auth_audit_log"`);
    await queryRunner.query(`drop table if exists "sessions"`);
    await queryRunner.query(`drop table if exists "users"`);
    await queryRunner.query(`drop table if exists "role_grants"`);
    await queryRunner.query(`drop table if exists "permissions"`);
    await queryRunner.query(`drop table if exists "roles"`);
  }
}
