/* eslint-disable no-console */
import 'dotenv/config';

import { createDatabase } from './database';
import { migrateToLatest } from './migrator';

/** CLI entry point: `pnpm db:migrate`. Applies all pending migrations. */
async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set — see apps/api/.env.example');

  const db = createDatabase(url);
  try {
    const { applied } = await migrateToLatest(db);

    if (applied.length === 0) {
      console.log('Already up to date — no pending migrations.');
    } else {
      for (const name of applied) console.log(`✓ ${name}`);
      console.log(`Applied ${applied.length} migration(s).`);
    }
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
