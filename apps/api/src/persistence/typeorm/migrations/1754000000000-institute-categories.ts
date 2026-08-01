import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Institute Category Management — the super-admin taxonomy plus its dynamic questions.
 *
 * Two tables rather than one blob-of-questions column: an institute's stored answer points at a
 * question by id, so a question must be a row the database can protect (foreign key, no
 * orphans), not an array element whose position could shift under it.
 */
export class InstituteCategories1754000000000 implements MigrationInterface {
  name = 'InstituteCategories1754000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`create extension if not exists citext`);

    await queryRunner.query(`
      create table "institute_categories" (
        "id" uuid primary key default gen_random_uuid(),
        "code" citext not null,
        "name" text not null,
        "description" text,
        "is_active" boolean not null default true,
        "version" integer not null default 1,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "created_by" uuid,
        "updated_by" uuid,
        constraint "institute_categories_code_uq" unique ("code"),
        constraint "institute_categories_created_by_fk" foreign key ("created_by") references "users" ("id"),
        constraint "institute_categories_updated_by_fk" foreign key ("updated_by") references "users" ("id"),
        constraint "institute_categories_code_chk" check (char_length("code") between 1 and 20),
        constraint "institute_categories_name_chk" check (char_length("name") between 1 and 100),
        constraint "institute_categories_version_chk" check ("version" > 0)
      )
    `);

    await queryRunner.query(`
      create table "institute_category_questions" (
        "id" uuid primary key default gen_random_uuid(),
        "category_id" uuid not null,
        "text" text not null,
        "type" text not null,
        "required" boolean not null default false,
        "options" jsonb not null default '[]'::jsonb,
        "sort_order" integer not null default 1,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "icq_category_fk" foreign key ("category_id")
          references "institute_categories" ("id") on delete cascade,
        constraint "icq_type_chk" check ("type" in ('text', 'radio', 'checkbox', 'select', 'file')),
        constraint "icq_text_chk" check (char_length("text") between 1 and 300),
        constraint "icq_options_chk" check (
          case
            when jsonb_typeof("options") <> 'array' then false
            when "type" in ('radio', 'checkbox', 'select') then jsonb_array_length("options") > 0
            else jsonb_array_length("options") = 0
          end
        )
      )
    `);

    // The only hot read path: a category's questions, already in display order.
    await queryRunner.query(
      `create index "icq_category_idx" on "institute_category_questions" ("category_id", "sort_order")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists "institute_category_questions"`);
    await queryRunner.query(`drop table if exists "institute_categories"`);
  }
}
