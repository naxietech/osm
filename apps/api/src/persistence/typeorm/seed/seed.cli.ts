/* eslint-disable no-console */
import { config as loadDotenv } from 'dotenv';
import 'reflect-metadata';

import { createDataSource } from '../data-source';
import { seedInstituteCategories } from './institute-categories.seed';
import { seedInstitutes } from './institutes.seed';
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

    const categories = await seedInstituteCategories(dataSource);
    console.log(
      `Institute categories: ${categories.categoriesCreated} created ` +
        `(${categories.questionsCreated} questions), ${categories.categoriesSkipped} already present.`,
    );

    // Institutes last: it files the demo institute under a category the step above just planted.
    const institutes = await seedInstitutes(dataSource);
    if (institutes.skippedReason) {
      console.log(`Institutes: ${institutes.skippedReason}`);
    } else {
      console.log(
        institutes.created
          ? `Institutes: demo institute created (numeric code ${institutes.numericCode}, ` +
              `${institutes.answersCreated} question answers).`
          : 'Institutes: demo institute already present.',
      );
    }
    if (institutes.usersRelinked > 0) {
      console.log(
        `Institutes: re-linked ${institutes.usersRelinked} institute user(s) that had no institute.`,
      );
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
