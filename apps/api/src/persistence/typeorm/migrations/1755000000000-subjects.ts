import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `subjects` — the national list of subjects/courses the curriculum, SLOs and exam papers all
 * point at.
 *
 * One table, three meaningful columns. Deliberately **not** client-scoped: every client teaches
 * the same curriculum, so this is national reference data rather than per-tenant configuration.
 * If per-client subject lists are ever needed, add `client_id` and widen the unique index from
 * `(code)` to `(client_id, code)` — the table is tiny, so that migration is seconds.
 *
 * No `version` column, unlike `institute_categories`: a subject is three scalar fields with no
 * child rows, so there is no partial-write to protect against and last-write-wins is the honest
 * behaviour. No `sort_order` either — the list is read alphabetically by name.
 *
 * The check constraints repeat the DTO's length rules on purpose, so bad data cannot arrive
 * through a path that skips Zod (a seed, a migration, a console).
 */
export class Subjects1755000000000 implements MigrationInterface {
  name = 'Subjects1755000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Already created by the institute-categories migration, which always runs first. Repeated
    // so this file states its own requirement rather than depending on a neighbour.
    await queryRunner.query(`create extension if not exists citext`);

    await queryRunner.query(`
      create table "subjects" (
        "id" uuid primary key default gen_random_uuid(),
        "code" citext not null,
        "name" text not null,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "created_by" uuid,
        "updated_by" uuid,
        constraint "subjects_code_uq" unique ("code"),
        constraint "subjects_created_by_fk" foreign key ("created_by") references "users" ("id"),
        constraint "subjects_updated_by_fk" foreign key ("updated_by") references "users" ("id"),
        constraint "subjects_code_chk" check (char_length("code") between 1 and 20),
        constraint "subjects_name_chk" check (char_length("name") between 1 and 100)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The citext extension is left in place: institute_categories.code still depends on it.
    await queryRunner.query(`drop table if exists "subjects"`);
  }
}
