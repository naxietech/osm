/* eslint-disable no-console */
import { config as loadDotenv } from 'dotenv';
import 'reflect-metadata';

import { createDataSource } from '../data-source';
import { seedDatabase } from './seed';

// apps/api/.env is the source of truth locally — override any stale shell value (e.g. a
// leftover `SUPERADMIN_PASSWORD` export) so the seeded credential always matches .env.
loadDotenv({ override: true });

/** CLI entry point: `pnpm db:seed`. Seeds RBAC + bootstraps the Super Admin from env. */
async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set — see apps/api/.env.example');

  const email = process.env['SUPERADMIN_EMAIL'];
  const password = process.env['SUPERADMIN_PASSWORD'];
  const fullName = process.env['SUPERADMIN_NAME'] ?? 'System Administrator';
  if (!email || !password) {
    throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set to bootstrap.');
  }

  const dataSource = createDataSource(url);
  await dataSource.initialize();
  try {
    const summary = await seedDatabase(dataSource, { superAdmin: { email, password, fullName } });
    console.log(
      `Seeded ${summary.permissions} permissions, ${summary.roles} roles, ${summary.grants} grants.`,
    );
    console.log(
      summary.superAdminCreated
        ? `Super Admin created: ${email}`
        : summary.superAdminPasswordReset
          ? `Super Admin password reset from .env and account unlocked: ${email}`
          : `Super Admin already matches .env (${email}) — unlocked, password unchanged.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
