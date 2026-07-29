import type { Kysely } from 'kysely';

import * as initialAuthSchema from './001-initial-auth-schema';

export interface AppMigration {
  up(db: Kysely<unknown>): Promise<void>;
  down(db: Kysely<unknown>): Promise<void>;
}

/**
 * Migration registry, kept in code (not a filesystem glob) so it runs identically
 * under ts-node, compiled dist, and the test runner. Keys are the names recorded in
 * `schema_migrations`; they run in lexicographic order.
 */
export const migrations: Record<string, AppMigration> = {
  '001-initial-auth-schema': initialAuthSchema,
};
