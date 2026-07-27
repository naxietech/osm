import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import type { Database } from './database.types';

export type AppDatabase = Kysely<Database>;

/**
 * Build a Kysely instance backed by a pg connection pool. The pool is lazy — no
 * socket is opened until the first query — so constructing this at module init is cheap.
 */
export function createDatabase(connectionString: string): AppDatabase {
  const dialect = new PostgresDialect({
    pool: new Pool({ connectionString, max: 10 }),
  });

  return new Kysely<Database>({ dialect });
}
