import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Institute Registration & Approval — the root of the whole data tree.
 *
 * Three tables rather than one, each separation deliberate:
 *
 * - `institutes` is the record itself.
 * - `institute_question_answers` is one row per answered question, because an answer points at a
 *   question by id. A jsonb blob would make that link invisible to the database, and the whole
 *   point is that Postgres refuses to delete a question somebody has answered.
 * - `institute_registration_credentials` holds the password an institute chooses on the public
 *   form, before the user account exists. It is a separate table so the institute repository
 *   cannot select a password hash by accident — a mapper cannot leak a column it never reads.
 *
 * Also converts `users.institute_id` from `text` to a real `uuid` foreign key. It has pointed at
 * nothing since the column was created; this is the migration that gives it something to point at.
 */
export class Institutes1758000000000 implements MigrationInterface {
  name = 'Institutes1758000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`create extension if not exists citext`);

    // Every institute gets a short number that student registration numbers and roll-number
    // blocks are built from. A sequence rather than `max(numeric_code) + 1`: reading then writing
    // is two steps, so two approvals at the same moment would pick the same number. nextval() is
    // atomic, and it never reissues a number after a rollback — which is what we want, because a
    // reused number would make an old registration number point at a different institute.
    await queryRunner.query(
      `create sequence "institute_numeric_code_seq" as integer start 1 minvalue 1`,
    );

    await queryRunner.query(`
      create table "institutes" (
        "id" uuid primary key default uuidv7(),
        "institute_code" citext not null,
        "numeric_code" integer,
        "institute_name" text not null,
        "branch" text,
        "category_id" uuid not null,
        "institution_type" text not null,
        "address" text not null,
        "city" text not null,
        "province" text not null,
        "postal_code" text,
        "contact_person_name" text not null,
        "contact_person_designation" text not null,
        "contact_email" citext not null,
        "contact_phone" text not null,
        "status" text not null default 'pending',
        "rejection_reason" text,
        "registration_source" text not null,
        "approved_by" uuid,
        "approved_at" timestamptz,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz,
        constraint "institutes_numeric_code_uq" unique ("numeric_code"),
        constraint "institutes_category_fk" foreign key ("category_id")
          references "institute_categories" ("id") on delete restrict,
        constraint "institutes_approved_by_fk" foreign key ("approved_by") references "users" ("id"),
        constraint "institutes_created_by_fk" foreign key ("created_by") references "users" ("id"),
        constraint "institutes_updated_by_fk" foreign key ("updated_by") references "users" ("id"),
        constraint "institutes_status_chk"
          check ("status" in ('pending', 'approved', 'rejected', 'deactivated')),
        constraint "institutes_type_chk"
          check ("institution_type" in ('government', 'semi_government', 'private', 'other')),
        constraint "institutes_province_chk"
          check ("province" in ('punjab', 'sindh', 'kpk', 'balochistan', 'ict', 'ajk', 'gb')),
        constraint "institutes_source_chk"
          check ("registration_source" in ('public', 'admin')),
        constraint "institutes_code_chk" check (char_length("institute_code") between 1 and 30),
        constraint "institutes_name_chk" check (char_length("institute_name") between 1 and 200),
        constraint "institutes_email_chk" check (char_length("contact_email") between 3 and 200),
        -- A rejection without a reason is useless to the institute that has to phone in and ask.
        constraint "institutes_rejection_chk"
          check ("status" <> 'rejected' or "rejection_reason" is not null),
        -- The numeric code is handed out at approval, so anything past pending must carry one.
        -- This is what stops an approval half-finishing and leaving an institute that student
        -- registration numbers cannot be built from.
        constraint "institutes_numeric_code_chk"
          check ("status" not in ('approved', 'deactivated') or "numeric_code" is not null)
      )
    `);

    // Uniqueness skips rejected and deleted rows, which is what lets a turned-away institute
    // apply again with its real code. `institute_code` is citext, so this is already
    // case-insensitive — S01 and s01 collide without a lower() wrapper.
    await queryRunner.query(`
      create unique index "institutes_code_live_uq" on "institutes" ("institute_code")
        where "status" <> 'rejected' and "deleted_at" is null
    `);

    // The approval queue: always the same filter, opened more often than any other screen.
    await queryRunner.query(`
      create index "institutes_pending_idx" on "institutes" ("created_at" desc)
        where "status" = 'pending' and "deleted_at" is null
    `);

    // The default listing order.
    await queryRunner.query(`
      create index "institutes_listing_idx" on "institutes" ("created_at" desc)
        where "deleted_at" is null
    `);

    // The duplicate-name warning on the approval screen. Names are deliberately not unique —
    // two "Government High School" in different cities is normal — so this only has to be fast
    // enough to run on every submission without scanning the table.
    await queryRunner.query(
      `create index "institutes_name_city_idx" on "institutes" (lower("institute_name"), lower("city"))`,
    );

    // Filtering the directory by category, and the restrict check when a category is deleted.
    await queryRunner.query(
      `create index "institutes_category_idx" on "institutes" ("category_id")`,
    );

    await queryRunner.query(`
      create table "institute_question_answers" (
        "id" uuid primary key default gen_random_uuid(),
        "institute_id" uuid not null,
        "question_id" uuid not null,
        "values" text[] not null default '{}',
        "created_at" timestamptz not null default now(),
        constraint "iqa_institute_fk" foreign key ("institute_id")
          references "institutes" ("id") on delete cascade,
        -- RESTRICT, not CASCADE: this is the constraint that makes Module 1's CategoryAnswerProbe
        -- real. Deleting an answered question would strand every answer to it, silently.
        constraint "iqa_question_fk" foreign key ("question_id")
          references "institute_category_questions" ("id") on delete restrict,
        constraint "iqa_unique" unique ("institute_id", "question_id"),
        constraint "iqa_values_chk" check (coalesce(array_length("values", 1), 0) <= 50)
      )
    `);

    // Postgres does not index the referencing side of a foreign key automatically. Without this,
    // every attempt to delete a question seq-scans the answers table.
    await queryRunner.query(
      `create index "iqa_question_idx" on "institute_question_answers" ("question_id")`,
    );

    await queryRunner.query(`
      create table "institute_registration_credentials" (
        "institute_id" uuid primary key,
        "password_hash" text not null,
        "created_at" timestamptz not null default now(),
        constraint "irc_institute_fk" foreign key ("institute_id")
          references "institutes" ("id") on delete cascade
      )
    `);

    // ---- users.institute_id: text -> uuid, with a real foreign key -------------------------
    //
    // Every value in this column today is a mock id from the frontend prototype (`sch_001` and
    // friends). There is no institute to preserve the link to, so they are cleared rather than
    // cast — keeping the strings would only carry a broken reference into a typed column. The
    // seed re-links the demo institute user immediately afterwards.
    //
    // If this migration ever meets a database holding real institute users, replace this UPDATE
    // with a mapping step first.
    await queryRunner.query(`update "users" set "institute_id" = null`);
    await queryRunner.query(
      `alter table "users" alter column "institute_id" type uuid using "institute_id"::uuid`,
    );
    await queryRunner.query(`
      alter table "users" add constraint "users_institute_fk"
        foreign key ("institute_id") references "institutes" ("id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The foreign key has to go before the institutes table it points at.
    await queryRunner.query(`alter table "users" drop constraint if exists "users_institute_fk"`);
    await queryRunner.query(
      `alter table "users" alter column "institute_id" type text using "institute_id"::text`,
    );

    await queryRunner.query(`drop table if exists "institute_registration_credentials"`);
    await queryRunner.query(`drop table if exists "institute_question_answers"`);
    await queryRunner.query(`drop table if exists "institutes"`);
    await queryRunner.query(`drop sequence if exists "institute_numeric_code_seq"`);
  }
}
