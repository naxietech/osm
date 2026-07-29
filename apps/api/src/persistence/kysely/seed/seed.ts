import { ALL_PERMISSION_ACTIONS } from '../../../rbac/permissions.constants';
import { SYSTEM_ROLES, SYSTEM_ROLE_IDS } from '../../../rbac/system-roles';
import { hashPassword, verifyPassword } from '../../../shared/crypto';
import type { AppDatabase } from '../database';

export interface SeedOptions {
  superAdmin: { email: string; password: string; fullName: string };
}

export interface SeedSummary {
  permissions: number;
  roles: number;
  grants: number;
  superAdminCreated: boolean;
  superAdminPasswordReset: boolean;
}

/**
 * Seed of RBAC + the bootstrap Super Admin. The catalogue / roles / grants are
 * insert-if-missing. The Super Admin is RECONCILED to the env credential every run so its
 * password can never silently drift from `apps/api/.env`: it is created if absent, otherwise
 * its password is reset to the env value (only when the stored one no longer matches) and the
 * account is always unlocked + reactivated. Runs in one transaction.
 *
 * The env `SUPERADMIN_PASSWORD` is the source of truth for this bootstrap account — if you
 * change it via the API, re-running the seed restores the env value.
 */
export async function seedDatabase(db: AppDatabase, opts: SeedOptions): Promise<SeedSummary> {
  const passwordHash = await hashPassword(opts.superAdmin.password);

  return db.transaction().execute(async (trx) => {
    await trx
      .insertInto('permissions')
      .values(ALL_PERMISSION_ACTIONS.map((action) => ({ action })))
      .onConflict((oc) => oc.column('action').doNothing())
      .execute();

    await trx
      .insertInto('roles')
      .values(SYSTEM_ROLES.map((r) => ({ id: r.id, name: r.name, is_system: true })))
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();

    const grantRows = SYSTEM_ROLES.flatMap((r) =>
      r.grants.map((g) => ({ role_id: r.id, action: g.action, scope: g.scope })),
    );
    await trx
      .insertInto('role_grants')
      .values(grantRows)
      .onConflict((oc) => oc.columns(['role_id', 'action']).doNothing())
      .execute();

    const existing = await trx
      .selectFrom('users')
      .select(['id', 'password_hash'])
      .where('email', '=', opts.superAdmin.email)
      .executeTakeFirst();

    let superAdminCreated = false;
    let superAdminPasswordReset = false;

    if (!existing) {
      await trx
        .insertInto('users')
        .values({
          email: opts.superAdmin.email,
          password_hash: passwordHash,
          role_id: SYSTEM_ROLE_IDS.superAdmin,
          full_name: opts.superAdmin.fullName,
          status: 'active',
        })
        .execute();
      superAdminCreated = true;
    } else {
      // Reconcile: guarantee the bootstrap Super Admin can log in with the current env
      // password and is never left locked. Rewrite the hash only if it has drifted.
      const matches = existing.password_hash
        ? await verifyPassword(existing.password_hash, opts.superAdmin.password)
        : false;
      superAdminPasswordReset = !matches;
      await trx
        .updateTable('users')
        .set({
          ...(matches ? {} : { password_hash: passwordHash }),
          failed_login_count: 0,
          locked_until: null,
          status: 'active',
          updated_at: new Date(),
        })
        .where('id', '=', existing.id)
        .execute();
    }

    return {
      permissions: ALL_PERMISSION_ACTIONS.length,
      roles: SYSTEM_ROLES.length,
      grants: grantRows.length,
      superAdminCreated,
      superAdminPasswordReset,
    };
  });
}
