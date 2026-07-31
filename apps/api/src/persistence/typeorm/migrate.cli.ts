/* eslint-disable no-console */
import { config as loadDotenv } from 'dotenv';
import 'reflect-metadata';

import { createDataSource } from './data-source';

// apps/api/.env is the source of truth locally — override any stale shell value.
loadDotenv({ override: true });

/**
 * CLI entry point: `pnpm db:migrate` (or `pnpm db:migrate:revert`). Runs all pending TypeORM
 * migrations, or reverts the most recently applied one with the `revert` argument.
 */
async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set — see apps/api/.env.example');

  const revert = process.argv.includes('revert');
  const dataSource = createDataSource(url);
  await dataSource.initialize();
  try {
    if (revert) {
      await dataSource.undoLastMigration();
      console.log('Reverted the last migration.');
      return;
    }

    const applied = await dataSource.runMigrations();
    if (applied.length === 0) {
      console.log('Already up to date — no pending migrations.');
    } else {
      for (const m of applied) console.log(`✓ ${m.name}`);
      console.log(`Applied ${applied.length} migration(s).`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
