import { ALL_PERMISSION_ACTIONS } from '../../../rbac/permissions.constants';
import { SYSTEM_ROLES, SYSTEM_ROLE_IDS } from '../../../rbac/system-roles';
import { hashPassword } from '../../../shared/crypto';
import type { AppDatabase } from '../database';

export interface SeedOptions {
  superAdmin: { email: string; password: string; fullName: string };
}

export interface SeedSummary {
  permissions: number;
  roles: number;
  grants: number;
  superAdminCreated: boolean;
}

/**
 * Idempotent seed: the permission catalogue, the five system roles + their grants,
 * and the bootstrap Super Admin. Safe to run repeatedly — existing rows are left
 * untouched (an already-present Super Admin is never overwritten). Runs in one
 * transaction so a partial seed can't be left behind.
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

    const inserted = await trx
      .insertInto('users')
      .values({
        email: opts.superAdmin.email,
        password_hash: passwordHash,
        role_id: SYSTEM_ROLE_IDS.superAdmin,
        full_name: opts.superAdmin.fullName,
        status: 'active',
      })
      .onConflict((oc) => oc.column('email').doNothing())
      .returning('id')
      .executeTakeFirst();

    return {
      permissions: ALL_PERMISSION_ACTIONS.length,
      roles: SYSTEM_ROLES.length,
      grants: grantRows.length,
      superAdminCreated: inserted !== undefined,
    };
  });
}
