import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    AuthModule,
    // Feature modules (schools, students, …) are frontend-only for now and will
    // be added here once the backend for each is built.
  ],
})
export class AppModule {}
