import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { buildDataSourceOptions } from './typeorm/data-source';

/**
 * Wires the shared TypeORM connection from `DATABASE_URL`. `TypeOrmModule.forRoot*` registers
 * the DataSource + EntityManager as global providers, so any module can `@InjectDataSource()`;
 * feature modules add `TypeOrmModule.forFeature([...])` to inject their own repositories. The
 * pg pool opens lazily and TypeORM closes it on shutdown, so no manual teardown is needed.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildDataSourceOptions(config.getOrThrow<string>('DATABASE_URL')),
    }),
  ],
})
export class PersistenceModule {}
