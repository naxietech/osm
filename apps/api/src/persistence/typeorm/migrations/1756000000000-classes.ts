import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Classes — the Class → Group → Subgroup hierarchy.
 *
 * Two tables, not three: `class_groups` holds groups and subgroups alike, told apart by
 * whether `parent_id` is set. They are the same thing at two depths, and one table means one
 * foreign-key target for the student and exam tables that will point at them later.
 *
 * Not a JSON column, for the same reason: a student's stored group must be a row the database
 * can protect, not an array element whose position could shift under it.
 *
 * Ids default to `uuidv7()` (a Postgres 18 built-in), matching what the RBAC tables were moved
 * to. A v7 uuid opens with a millisecond timestamp, so new rows append to the end of the
 * primary-key index instead of scattering through it the way `gen_random_uuid()` does.
 */
export class Classes1756000000000 implements MigrationInterface {
  name = 'Classes1756000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`create extension if not exists citext`);

    await queryRunner.query(`
      create table "classes" (
        "id" uuid primary key default uuidv7(),
        "name" citext not null,
        "ordinal" smallint not null,
        "description" text,
        "is_active" boolean not null default true,
        "version" integer not null default 1,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "created_by" uuid,
        "updated_by" uuid,
        constraint "classes_name_uq" unique ("name"),
        constraint "classes_created_by_fk" foreign key ("created_by") references "users" ("id"),
        constraint "classes_updated_by_fk" foreign key ("updated_by") references "users" ("id"),
        constraint "classes_name_chk" check (char_length("name") between 1 and 60),
        constraint "classes_ordinal_chk" check ("ordinal" between 1 and 99),
        constraint "classes_description_chk" check ("description" is null or char_length("description") <= 200),
        constraint "classes_version_chk" check ("version" > 0)
      )
    `);

    // Progression order, then name as a stable tie-break — two classes may share an ordinal
    // while an admin is midway through reordering them.
    await queryRunner.query(`create index "classes_ordinal_idx" on "classes" ("ordinal", "name")`);

    await queryRunner.query(`
      create table "class_groups" (
        "id" uuid primary key default uuidv7(),
        "class_id" uuid not null,
        "parent_id" uuid,
        "name" citext not null,
        "sort_order" smallint not null default 1,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "class_groups_class_fk" foreign key ("class_id")
          references "classes" ("id") on delete cascade,
        constraint "class_groups_name_chk" check (char_length("name") between 1 and 60),
        constraint "class_groups_sort_order_chk" check ("sort_order" between 1 and 999),
        -- The composite foreign key below needs a unique key on exactly these two columns to
        -- point at. Redundant on its own (id is already the primary key) and cheap.
        constraint "class_groups_id_class_uq" unique ("id", "class_id")
      )
    `);

    // A subgroup must live in the same class as the group above it. Pairing `parent_id` with
    // `class_id` is what makes that impossible to violate: the referenced row has to match on
    // BOTH columns, so a subgroup cannot be adopted by a group in another class.
    //
    // A group row has `parent_id` null, and a composite foreign key with a null in it is not
    // checked at all (the default MATCH SIMPLE) — which is exactly right, since a group has no
    // parent to validate.
    await queryRunner.query(`
      alter table "class_groups"
        add constraint "class_groups_parent_fk"
        foreign key ("parent_id", "class_id")
        references "class_groups" ("id", "class_id") on delete cascade
    `);

    // Names are unique among siblings, and only among siblings: two different classes may both
    // have a "Science" group, and two different groups may both have a "Biology" subgroup.
    // Partial indexes because the scope differs by depth — groups are scoped by class, and
    // subgroups by their parent group.
    //
    // `name` is citext, so these also catch "science" against "Science".
    await queryRunner.query(`
      create unique index "class_groups_group_name_uq"
        on "class_groups" ("class_id", "name") where "parent_id" is null
    `);
    await queryRunner.query(`
      create unique index "class_groups_subgroup_name_uq"
        on "class_groups" ("parent_id", "name") where "parent_id" is not null
    `);

    // The read path: a class's whole tree in one query, already in display order.
    //
    // `sort_order` is a real column for the same reason `classes.ordinal` is. Groups are
    // written in one statement, so `created_at` is identical across them to the microsecond
    // and could never separate them; ordering would fall through to `id`, and a v7 uuid only
    // orders down to the millisecond — siblings written together share one, leaving the random
    // tail to decide, so the tree would come back shuffled on every read. Position is scoped to
    // the parent — groups are numbered within their class, subgroups within their group.
    await queryRunner.query(
      `create index "class_groups_class_idx" on "class_groups" ("class_id", "parent_id", "sort_order")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists "class_groups"`);
    await queryRunner.query(`drop table if exists "classes"`);
  }
}
