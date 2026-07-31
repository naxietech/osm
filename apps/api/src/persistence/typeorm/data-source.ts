import { DataSource, type DataSourceOptions } from 'typeorm';

import { AUTH_ENTITIES } from './entities';
import { InitialAuthSchema1730000000000 } from './migrations/1730000000000-initial-auth-schema';

/**
 * Migrations are listed explicitly (not a filesystem glob) so the set resolves identically
 * under ts-node, compiled dist, and Jest — the same reason the previous migrator kept a code
 * registry. `synchronize` is hard-off: schema changes only ever happen through a migration.
 */
export function buildDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: AUTH_ENTITIES,
    migrations: [InitialAuthSchema1730000000000],
    synchronize: false,
    logging: false,
  };
}

/** Build (but do not connect) a DataSource. The pg pool opens lazily on `initialize()`. */
export function createDataSource(url: string): DataSource {
  return new DataSource(buildDataSourceOptions(url));
}

/**
 * Default DataSource for the TypeORM CLI (`typeorm migration:generate`, etc.). Application
 * code uses NestJS's TypeOrmModule; the CLIs (`db:migrate`, `db:seed`) build their own from
 * `DATABASE_URL`. Constructed lazily, so an unset URL only fails when a command connects.
 */
export const AppDataSource = createDataSource(process.env['DATABASE_URL'] ?? '');
export default AppDataSource;
