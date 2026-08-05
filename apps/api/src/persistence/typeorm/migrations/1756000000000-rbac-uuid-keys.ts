import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Give roles and permissions real surrogate keys.
 *
 * Before: `roles.id` was a hand-typed slug (`role_super_admin`) and `permissions` was a single
 * `action` column used directly as the key. Both worked while the catalogue was fixed and named
 * in code, but neither survives custom roles (nothing sensible to type) or a permissions screen
 * (nowhere to put a label or a group).
 *
 * After: both carry a uuid `id`, and the old human-readable value lives on as a `code` column —
 * still unique, still what code matches on. The five system roles keep **fixed** uuids so
 * `SYSTEM_ROLE_IDS` stays a compile-time constant and every guard, token and comparison that
 * reads it is untouched. Anything created later gets `uuidv7()`, which begins with a timestamp
 * so new rows append to the end of an index rather than scattering through it.
 *
 * Written to preserve data: columns are added, backfilled, and only then swapped, so a database
 * that already has users keeps every role assignment and grant.
 */
export class RbacUuidKeys1756000000000 implements MigrationInterface {
  name = 'RbacUuidKeys1756000000000';

  /** Fixed ids for the seeded roles — mirrored by SYSTEM_ROLE_IDS in `rbac/system-roles.ts`. */
  private static readonly SYSTEM_ROLES: Array<{ slug: string; code: string; id: string }> = [
    { slug: 'role_super_admin', code: 'super_admin', id: '019fc9fe-9756-7829-86f1-fc4c79b7ab36' },
    { slug: 'role_admin', code: 'admin', id: '019fc9fe-9756-7849-bb20-8c3c8213b4c5' },
    { slug: 'role_controller', code: 'controller', id: '019fc9fe-9756-7851-8368-55cd6e8d7874' },
    { slug: 'role_checker', code: 'checker', id: '019fc9fe-9756-7856-ae6a-ae9b60217577' },
    { slug: 'role_institute', code: 'institute', id: '019fc9fe-9756-785b-925d-8ab3063888b0' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- roles: slug id -> uuid id + code ----
    await queryRunner.query(`alter table "roles" add column "code" text`);
    await queryRunner.query(`alter table "roles" add column "id_uuid" uuid`);

    // Known roles keep a fixed id so code can name them; anything else gets a fresh v7.
    for (const role of RbacUuidKeys1756000000000.SYSTEM_ROLES) {
      await queryRunner.query(`update "roles" set "code" = $1, "id_uuid" = $2 where "id" = $3`, [
        role.code,
        role.id,
        role.slug,
      ]);
    }
    // Any custom role already in the table: derive a code from its slug, mint a v7 id.
    await queryRunner.query(`
      update "roles"
         set "code" = regexp_replace("id", '^role_', ''),
             "id_uuid" = uuidv7()
       where "id_uuid" is null
    `);

    await queryRunner.query(`alter table "roles" alter column "code" set not null`);
    await queryRunner.query(`alter table "roles" alter column "id_uuid" set not null`);

    // ---- repoint every referencing column while the old ids are still present ----
    await queryRunner.query(`alter table "users" add column "role_id_uuid" uuid`);
    await queryRunner.query(
      `update "users" u set "role_id_uuid" = r."id_uuid" from "roles" r where r."id" = u."role_id"`,
    );
    await queryRunner.query(`alter table "users" alter column "role_id_uuid" set not null`);

    await queryRunner.query(`alter table "role_grants" add column "role_id_uuid" uuid`);
    await queryRunner.query(
      `update "role_grants" g set "role_id_uuid" = r."id_uuid" from "roles" r where r."id" = g."role_id"`,
    );

    // ---- permissions: action-as-key -> uuid id + action code (+ room for a UI label) ----
    await queryRunner.query(`alter table "permissions" add column "id" uuid`);
    await queryRunner.query(`alter table "permissions" add column "label" text`);
    await queryRunner.query(`alter table "permissions" add column "group_name" text`);
    await queryRunner.query(`update "permissions" set "id" = uuidv7() where "id" is null`);
    await queryRunner.query(`alter table "permissions" alter column "id" set not null`);

    await queryRunner.query(`alter table "role_grants" add column "permission_id" uuid`);
    await queryRunner.query(
      `update "role_grants" g set "permission_id" = p."id" from "permissions" p where p."action" = g."action"`,
    );

    // ---- drop the old keys and swap in the new ones ----
    await queryRunner.query(`alter table "role_grants" drop constraint "role_grants_pk"`);
    await queryRunner.query(`alter table "role_grants" drop constraint "role_grants_role_fk"`);
    await queryRunner.query(`alter table "role_grants" drop constraint "role_grants_action_fk"`);
    await queryRunner.query(`alter table "users" drop constraint "users_role_fk"`);
    await queryRunner.query(`alter table "roles" drop constraint "roles_pkey"`);
    await queryRunner.query(`alter table "permissions" drop constraint "permissions_pkey"`);

    await queryRunner.query(`alter table "role_grants" drop column "role_id"`);
    await queryRunner.query(`alter table "role_grants" drop column "action"`);
    await queryRunner.query(`alter table "users" drop column "role_id"`);
    await queryRunner.query(`alter table "roles" drop column "id"`);

    await queryRunner.query(`alter table "roles" rename column "id_uuid" to "id"`);
    await queryRunner.query(`alter table "users" rename column "role_id_uuid" to "role_id"`);
    await queryRunner.query(`alter table "role_grants" rename column "role_id_uuid" to "role_id"`);

    await queryRunner.query(`alter table "roles" add constraint "roles_pkey" primary key ("id")`);
    await queryRunner.query(`alter table "roles" alter column "id" set default uuidv7()`);
    await queryRunner.query(`alter table "roles" add constraint "roles_code_uq" unique ("code")`);
    await queryRunner.query(
      `alter table "permissions" add constraint "permissions_pkey" primary key ("id")`,
    );
    await queryRunner.query(`alter table "permissions" alter column "id" set default uuidv7()`);
    await queryRunner.query(
      `alter table "permissions" add constraint "permissions_action_uq" unique ("action")`,
    );

    await queryRunner.query(`alter table "role_grants" alter column "role_id" set not null`);
    await queryRunner.query(`alter table "role_grants" alter column "permission_id" set not null`);
    await queryRunner.query(
      `alter table "role_grants" add constraint "role_grants_pk" primary key ("role_id", "permission_id")`,
    );
    await queryRunner.query(`
      alter table "role_grants" add constraint "role_grants_role_fk"
        foreign key ("role_id") references "roles" ("id") on delete cascade
    `);
    await queryRunner.query(`
      alter table "role_grants" add constraint "role_grants_permission_fk"
        foreign key ("permission_id") references "permissions" ("id")
    `);
    await queryRunner.query(`
      alter table "users" add constraint "users_role_fk"
        foreign key ("role_id") references "roles" ("id")
    `);
    await queryRunner.query(`create index "users_role_idx2" on "users" ("role_id")`);

    // ---- new tables mint v7 ids from here on; existing v4 ids are left alone ----
    await queryRunner.query(`alter table "users" alter column "id" set default uuidv7()`);
    await queryRunner.query(`alter table "sessions" alter column "id" set default uuidv7()`);

    // ---- soft delete for users (see the users module) ----
    await queryRunner.query(`alter table "users" add column "deleted_at" timestamptz`);
    await queryRunner.query(
      `create index "users_active_idx" on "users" ("deleted_at") where "deleted_at" is null`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists "users_active_idx"`);
    await queryRunner.query(`alter table "users" drop column if exists "deleted_at"`);
    await queryRunner.query(`alter table "users" alter column "id" set default gen_random_uuid()`);
    await queryRunner.query(
      `alter table "sessions" alter column "id" set default gen_random_uuid()`,
    );

    // Rebuild the slug keys from `code`, reversing the swap above.
    await queryRunner.query(`alter table "roles" add column "id_slug" text`);
    await queryRunner.query(`update "roles" set "id_slug" = 'role_' || "code"`);
    await queryRunner.query(`alter table "users" add column "role_id_slug" text`);
    await queryRunner.query(
      `update "users" u set "role_id_slug" = r."id_slug" from "roles" r where r."id" = u."role_id"`,
    );
    await queryRunner.query(`alter table "role_grants" add column "role_id_slug" text`);
    await queryRunner.query(
      `update "role_grants" g set "role_id_slug" = r."id_slug" from "roles" r where r."id" = g."role_id"`,
    );
    await queryRunner.query(`alter table "role_grants" add column "action" text`);
    await queryRunner.query(
      `update "role_grants" g set "action" = p."action" from "permissions" p where p."id" = g."permission_id"`,
    );

    await queryRunner.query(`drop index if exists "users_role_idx2"`);
    await queryRunner.query(`alter table "users" drop constraint "users_role_fk"`);
    await queryRunner.query(`alter table "role_grants" drop constraint "role_grants_pk"`);
    await queryRunner.query(`alter table "role_grants" drop constraint "role_grants_role_fk"`);
    await queryRunner.query(
      `alter table "role_grants" drop constraint "role_grants_permission_fk"`,
    );
    await queryRunner.query(`alter table "roles" drop constraint "roles_code_uq"`);
    await queryRunner.query(`alter table "roles" drop constraint "roles_pkey"`);
    await queryRunner.query(`alter table "permissions" drop constraint "permissions_action_uq"`);
    await queryRunner.query(`alter table "permissions" drop constraint "permissions_pkey"`);

    await queryRunner.query(`alter table "role_grants" drop column "role_id"`);
    await queryRunner.query(`alter table "role_grants" drop column "permission_id"`);
    await queryRunner.query(`alter table "users" drop column "role_id"`);
    await queryRunner.query(`alter table "roles" drop column "id"`);
    await queryRunner.query(`alter table "roles" drop column "code"`);
    await queryRunner.query(`alter table "permissions" drop column "id"`);
    await queryRunner.query(`alter table "permissions" drop column "label"`);
    await queryRunner.query(`alter table "permissions" drop column "group_name"`);

    await queryRunner.query(`alter table "roles" rename column "id_slug" to "id"`);
    await queryRunner.query(`alter table "users" rename column "role_id_slug" to "role_id"`);
    await queryRunner.query(`alter table "role_grants" rename column "role_id_slug" to "role_id"`);

    await queryRunner.query(`alter table "roles" add constraint "roles_pkey" primary key ("id")`);
    await queryRunner.query(
      `alter table "permissions" add constraint "permissions_pkey" primary key ("action")`,
    );
    await queryRunner.query(`alter table "users" alter column "role_id" set not null`);
    await queryRunner.query(`alter table "role_grants" alter column "role_id" set not null`);
    await queryRunner.query(`alter table "role_grants" alter column "action" set not null`);
    await queryRunner.query(
      `alter table "role_grants" add constraint "role_grants_pk" primary key ("role_id", "action")`,
    );
    await queryRunner.query(`
      alter table "role_grants" add constraint "role_grants_role_fk"
        foreign key ("role_id") references "roles" ("id") on delete cascade
    `);
    await queryRunner.query(`
      alter table "role_grants" add constraint "role_grants_action_fk"
        foreign key ("action") references "permissions" ("action")
    `);
    await queryRunner.query(`
      alter table "users" add constraint "users_role_fk"
        foreign key ("role_id") references "roles" ("id")
    `);
  }
}
