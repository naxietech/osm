import type { AppDatabase } from './kysely/database';

/** DI token for the shared Kysely instance. Inject with `@Inject(KYSELY_DB)`. */
export const KYSELY_DB = 'KYSELY_DB';

export type { AppDatabase };
