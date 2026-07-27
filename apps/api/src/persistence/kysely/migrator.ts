import { type Kysely, sql } from 'kysely';

import { migrations } from './migrations';

export interface MigrateResult {
  applied: string[];
}

/**
 * Minimal forward migrator: records applied migrations in `schema_migrations` and runs
 * each pending `up()` in its own transaction. Hand-rolled (rather than Kysely's Migrator)
 * because migrations are schema-level and DB-type-agnostic — this keeps everything on the
 * plain `sql` API and avoids Kysely's subpath-only Migrator export, which our CommonJS
 * `node` module resolution can't load at both type- and run-time.
 */
export async function migrateToLatest<DB>(database: Kysely<DB>): Promise<MigrateResult> {
  // migrations operate on the schema, not typed tables — treat the handle generically.
  const db = database as unknown as Kysely<unknown>;

  await sql`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `.execute(db);

  const existing = await sql<{ name: string }>`select name from schema_migrations`.execute(db);
  const done = new Set(existing.rows.map((r) => r.name));

  const applied: string[] = [];
  for (const name of Object.keys(migrations).sort()) {
    const migration = migrations[name];
    if (!migration || done.has(name)) continue;

    await db.transaction().execute(async (trx) => {
      await migration.up(trx);
      await sql`insert into schema_migrations (name) values (${name})`.execute(trx);
    });
    applied.push(name);
  }

  return { applied };
}
