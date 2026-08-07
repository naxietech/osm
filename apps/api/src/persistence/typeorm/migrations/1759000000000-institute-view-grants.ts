import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Splits institute access into view + manage, and corrects the Admin role on databases that
 * already exist.
 *
 * Approving, deactivating or deleting an institute is a Super Admin decision. An Admin still has
 * to look one up constantly — while working on students, exams and registrations — so the answer
 * is two grants rather than one, not a role check buried in a controller.
 *
 * **Why this needs a migration at all.** `seed.ts` is insert-only (`orIgnore`), which is right:
 * re-running it must never overwrite grants an operator changed on purpose. The cost is that it
 * cannot take a grant *away*. A database seeded before this change keeps `institutes.manage` on
 * Admin forever, so on any deployed environment an Admin would still be able to approve and
 * deactivate institutes — the exact thing the split exists to stop. A fresh database is already
 * correct; this is only for the ones that are not.
 *
 * **Everything joins on the natural key.** `permissions.id` defaults to `uuidv7()`, so the id for
 * `institutes.view` is different in every database and a hardcoded uuid here would silently grant
 * the wrong permission — or nothing at all. Permissions are matched by `action` and roles by
 * `code`, both of which carry a unique constraint.
 *
 * **Custom roles are left alone.** Only the two system roles are touched. A custom role that was
 * deliberately given `institutes.manage` keeps it; that was somebody's decision, and this
 * migration has no business reversing it.
 *
 * Idempotent in both directions — safe to run against a database that is already in the target
 * state, which is what makes it safe to ship alongside a fresh seed.
 */
export class InstituteViewGrants1759000000000 implements MigrationInterface {
  name = 'InstituteViewGrants1759000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The catalogue is seeded, not migrated, so the two new actions have to be planted here too —
    // a grant cannot reference a permission row that does not exist yet.
    await queryRunner.query(
      `insert into "permissions" ("action") values ('institutes.view'), ('institute-categories.view') ` +
        `on conflict ("action") do nothing`,
    );

    // Super Admin holds every action by definition, and Admin gets exactly the two view grants.
    await queryRunner.query(
      `insert into "role_grants" ("role_id", "permission_id", "scope") ` +
        `select r."id", p."id", 'all' from "roles" r cross join "permissions" p ` +
        `where r."code" in ('super_admin', 'admin') ` +
        `and p."action" in ('institutes.view', 'institute-categories.view') ` +
        `on conflict ("role_id", "permission_id") do nothing`,
    );

    // The correction. `institute-categories.manage` was never on Admin in this codebase, so that
    // half is a no-op on any database seeded from it — it is named anyway so the statement says
    // what Admin must end up with, rather than only what this one release changed. An environment
    // whose grants were edited by hand lands in the same place either way.
    await queryRunner.query(
      `delete from "role_grants" g using "roles" r, "permissions" p ` +
        `where g."role_id" = r."id" and g."permission_id" = p."id" ` +
        `and r."code" = 'admin' ` +
        `and p."action" in ('institutes.manage', 'institute-categories.manage')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `insert into "role_grants" ("role_id", "permission_id", "scope") ` +
        `select r."id", p."id", 'all' from "roles" r cross join "permissions" p ` +
        `where r."code" = 'admin' and p."action" = 'institutes.manage' ` +
        `on conflict ("role_id", "permission_id") do nothing`,
    );

    await queryRunner.query(
      `delete from "role_grants" g using "roles" r, "permissions" p ` +
        `where g."role_id" = r."id" and g."permission_id" = p."id" ` +
        `and r."code" in ('super_admin', 'admin') ` +
        `and p."action" in ('institutes.view', 'institute-categories.view')`,
    );

    // Only if nothing else points at them. A custom role created after this migration ran may
    // legitimately hold a view grant, and dropping the permission row out from under it would
    // either fail on the foreign key or, worse, take that role's capability with it. Leaving an
    // unused row in the catalogue is the harmless outcome.
    await queryRunner.query(
      `delete from "permissions" p ` +
        `where p."action" in ('institutes.view', 'institute-categories.view') ` +
        `and not exists (select 1 from "role_grants" g where g."permission_id" = p."id")`,
    );
  }
}
