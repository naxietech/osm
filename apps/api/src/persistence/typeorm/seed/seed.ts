import type { DataSource } from 'typeorm';

import { ALL_PERMISSION_ACTIONS } from '../../../rbac/permissions.constants';
import { SYSTEM_ROLES, SYSTEM_ROLE_IDS } from '../../../rbac/system-roles';
import { hashPassword, verifyPassword } from '../../../shared/crypto';
import { PermissionEntity, RoleEntity, RoleGrantEntity, UserEntity } from '../entities';

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
export async function seedDatabase(
  dataSource: DataSource,
  opts: SeedOptions,
): Promise<SeedSummary> {
  const passwordHash = await hashPassword(opts.superAdmin.password);

  return dataSource.transaction(async (manager) => {
    await manager
      .getRepository(PermissionEntity)
      .createQueryBuilder()
      .insert()
      .values(ALL_PERMISSION_ACTIONS.map((action) => ({ action })))
      .orIgnore()
      .execute();

    await manager
      .getRepository(RoleEntity)
      .createQueryBuilder()
      .insert()
      .values(SYSTEM_ROLES.map((r) => ({ id: r.id, code: r.code, name: r.name, isSystem: true })))
      .orIgnore()
      .execute();

    // Grants reference a permission by id now, so resolve action -> id from the rows just
    // inserted. One query rather than a lookup per grant.
    const permissions = await manager.getRepository(PermissionEntity).find();
    const idByAction = new Map(permissions.map((p) => [p.action, p.id]));

    const grantRows = SYSTEM_ROLES.flatMap((r) =>
      r.grants.map((g) => {
        const permissionId = idByAction.get(g.action);
        if (!permissionId) {
          throw new Error(`Permission "${g.action}" is missing from the catalogue`);
        }
        return { roleId: r.id, permissionId, scope: g.scope };
      }),
    );
    await manager
      .getRepository(RoleGrantEntity)
      .createQueryBuilder()
      .insert()
      .values(grantRows)
      .orIgnore()
      .execute();

    const users = manager.getRepository(UserEntity);
    const existing = await users.findOne({
      where: { email: opts.superAdmin.email },
      select: ['id', 'passwordHash'],
    });

    let superAdminCreated = false;
    let superAdminPasswordReset = false;

    if (!existing) {
      await users.insert({
        email: opts.superAdmin.email,
        passwordHash,
        roleId: SYSTEM_ROLE_IDS.superAdmin,
        fullName: opts.superAdmin.fullName,
        status: 'active',
      });
      superAdminCreated = true;
    } else {
      // Reconcile: guarantee the bootstrap Super Admin can log in with the current env
      // password and is never left locked. Rewrite the hash only if it has drifted.
      const matches = existing.passwordHash
        ? await verifyPassword(existing.passwordHash, opts.superAdmin.password)
        : false;
      superAdminPasswordReset = !matches;
      await users.update(
        { id: existing.id },
        {
          ...(matches ? {} : { passwordHash }),
          failedLoginCount: 0,
          lockedUntil: null,
          status: 'active',
          updatedAt: new Date(),
        },
      );
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
