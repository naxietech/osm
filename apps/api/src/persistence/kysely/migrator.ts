import { type Kysely, sql } from 'kysely';

import { migrations } from './migrations';

export interface MigrateResult {
  applied: string[];
}

/** Fixed key for the migration advisory lock — arbitrary, but stable app-wide. */
const MIGRATION_LOCK_KEY = 4915012;

/**
 * Minimal forward migrator: records applied migrations in `schema_migrations` and applies
 * each pending `up()`. Hand-rolled (rather than Kysely's Migrator) because migrations are
 * schema-level and DB-type-agnostic — this keeps everything on the plain `sql` API and
 * avoids Kysely's subpath-only Migrator export, which our CommonJS `node` module resolution
 * can't load at both type- and run-time.
 *
 * The whole run executes inside ONE transaction guarded by a transaction-scoped advisory
 * lock (`pg_advisory_xact_lock`), so two concurrent migrators (e.g. two replicas deploying
 * at once) can't race: the loser blocks on the lock, then sees the migrations already
 * applied and does nothing. The lock releases automatically at commit/rollback, and running
 * everything in one transaction means a mid-run failure rolls the whole batch back cleanly.
 */
export async function migrateToLatest<DB>(database: Kysely<DB>): Promise<MigrateResult> {
  // migrations operate on the schema, not typed tables — treat the handle generically.
  const db = database as unknown as Kysely<unknown>;

  return db.transaction().execute(async (trx) => {
    await sql`select pg_advisory_xact_lock(${MIGRATION_LOCK_KEY})`.execute(trx);

    await sql`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `.execute(trx);

    const existing = await sql<{ name: string }>`select name from schema_migrations`.execute(trx);
    const done = new Set(existing.rows.map((r) => r.name));

    const applied: string[] = [];
    for (const name of Object.keys(migrations).sort()) {
      const migration = migrations[name];
      if (!migration || done.has(name)) continue;

      await migration.up(trx);
      await sql`insert into schema_migrations (name) values (${name})`.execute(trx);
      applied.push(name);
    }

    return { applied };
  });
}
