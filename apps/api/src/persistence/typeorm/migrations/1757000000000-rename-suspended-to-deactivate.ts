import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renames the `suspended` account status to `deactivate`.
 *
 * Vocabulary only — the behaviour is unchanged. "Deactivate" is the word the product uses for a
 * reversible account switch-off; "suspended" reads as a punishment and was never what the state
 * meant. `active`, `pending` and `locked` keep their names: the first is already the right
 * adjective, and the other two are set by the system rather than by an admin.
 *
 * The check constraint has to come off before the rows can be rewritten — `deactivate` is not a
 * legal value until the new constraint replaces it, so the order here is drop → rewrite → add.
 * Both directions are lossless: nothing but the spelling of one string changes.
 */
export class RenameSuspendedToDeactivate1757000000000 implements MigrationInterface {
  name = 'RenameSuspendedToDeactivate1757000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table "users" drop constraint "users_status_chk"`);
    await queryRunner.query(
      `update "users" set "status" = 'deactivate' where "status" = 'suspended'`,
    );
    await queryRunner.query(
      `alter table "users" add constraint "users_status_chk" ` +
        `check ("status" in ('pending', 'active', 'deactivate', 'locked'))`,
    );

    // Session revocations stamped the old word as their reason. It is free text with no
    // constraint, so this is cosmetic — but leaving it would mean the audit trail explains a
    // deactivation using a word that no longer exists anywhere else in the system.
    await queryRunner.query(
      `update "sessions" set "revoked_reason" = 'deactivate' where "revoked_reason" = 'suspended'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `update "sessions" set "revoked_reason" = 'suspended' where "revoked_reason" = 'deactivate'`,
    );
    await queryRunner.query(`alter table "users" drop constraint "users_status_chk"`);
    await queryRunner.query(
      `update "users" set "status" = 'suspended' where "status" = 'deactivate'`,
    );
    await queryRunner.query(
      `alter table "users" add constraint "users_status_chk" ` +
        `check ("status" in ('pending', 'active', 'suspended', 'locked'))`,
    );
  }
}
