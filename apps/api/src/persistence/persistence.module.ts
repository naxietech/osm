import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { type AppDatabase, KYSELY_DB } from './database.token';
import { createDatabase } from './kysely/database';

/**
 * Provides the shared Kysely instance (token `KYSELY_DB`) to the whole app. Global so
 * feature modules can inject it without re-importing. The pg pool is lazy, so app boot
 * doesn't open a connection; the pool is closed on shutdown.
 */
@Global()
@Module({
  providers: [
    {
      provide: KYSELY_DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AppDatabase =>
        createDatabase(config.getOrThrow<string>('DATABASE_URL')),
    },
  ],
  exports: [KYSELY_DB],
})
export class PersistenceModule implements OnModuleDestroy {
  constructor(@Inject(KYSELY_DB) private readonly db: AppDatabase) {}

  async onModuleDestroy(): Promise<void> {
    await this.db.destroy();
  }
}
