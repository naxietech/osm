import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { getAuthKeys } from '../config/auth-keys';
import { AUTH_CONFIG, loadAuthConfig } from '../config/auth.config';
import { AUTH_REPOSITORY_PROVIDERS } from '../persistence/kysely/repositories';
import { AuthController } from './auth.controller';
import { PermissionsGuard, RolesGuard } from './guards';
import { RolesController } from './roles.controller';
import {
  AuthService,
  PermissionResolver,
  RolesService,
  SessionService,
  TokenService,
  UsersService,
} from './services';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersController } from './users.controller';

@Module({
  imports: [
    PassportModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const keys = getAuthKeys(config);
        return {
          privateKey: keys.privateKey,
          publicKey: keys.publicKey,
          signOptions: {
            algorithm: 'RS256',
            expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '15m',
          },
          verifyOptions: { algorithms: ['RS256'] },
        };
      },
    }),
  ],
  controllers: [AuthController, UsersController, RolesController],
  providers: [
    AuthService,
    SessionService,
    TokenService,
    UsersService,
    RolesService,
    PermissionResolver,
    JwtStrategy,
    RolesGuard,
    PermissionsGuard,
    // Baseline per-IP rate limit on every route (per-route @Throttle tightens it).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: AUTH_CONFIG, inject: [ConfigService], useFactory: loadAuthConfig },
    ...AUTH_REPOSITORY_PROVIDERS,
  ],
  exports: [JwtModule, PermissionResolver, RolesGuard, PermissionsGuard],
})
export class AuthModule {}
