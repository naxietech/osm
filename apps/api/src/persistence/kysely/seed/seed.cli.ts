/* eslint-disable no-console */
import 'dotenv/config';

import { createDatabase } from '../database';
import { seedDatabase } from './seed';

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

  const db = createDatabase(url);
  try {
    const summary = await seedDatabase(db, { superAdmin: { email, password, fullName } });
    console.log(
      `Seeded ${summary.permissions} permissions, ${summary.roles} roles, ${summary.grants} grants.`,
    );
    console.log(
      summary.superAdminCreated
        ? `Super Admin created: ${email}`
        : `Super Admin already exists (${email}) — left unchanged.`,
    );
  } finally {
    await db.destroy();
  }
}

void main();
