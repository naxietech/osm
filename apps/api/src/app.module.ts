import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { PersistenceModule } from './persistence/persistence.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    // Global baseline per-IP rate limit on every route (per-route @Throttle tightens it).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PersistenceModule,
    AuthModule,
    // Feature modules (schools, students, …) are frontend-only for now and will
    // be added here once the backend for each is built.
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
