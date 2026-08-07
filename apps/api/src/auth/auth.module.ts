import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { getAuthKeys } from '../config/auth-keys';
import { AUTH_CONFIG, loadAuthConfig } from '../config/auth.config';
import { AUTH_ENTITIES } from '../persistence/typeorm/entities';
import { AUTH_REPOSITORY_PROVIDERS } from '../persistence/typeorm/repositories';
import { AuthController } from './auth.controller';
import { ActiveUserGuard, PermissionsGuard, RolesGuard } from './guards';
import { AUTH_AUDIT_REPOSITORY, USER_REPOSITORY } from './ports';
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
    TypeOrmModule.forFeature(AUTH_ENTITIES),
    PassportModule,
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
    ActiveUserGuard,
    { provide: AUTH_CONFIG, inject: [ConfigService], useFactory: loadAuthConfig },
    ...AUTH_REPOSITORY_PROVIDERS,
  ],
  // Feature modules reuse these guards. `@UseGuards(SomeGuard)` makes Nest resolve the guard in
  // the *consuming* module's injector, so USER_REPOSITORY must be exported alongside
  // ActiveUserGuard or the guard cannot be constructed there.
  exports: [
    JwtModule,
    PermissionResolver,
    RolesGuard,
    PermissionsGuard,
    ActiveUserGuard,
    USER_REPOSITORY,
    // Feature modules write to the audit trail too — approving an institute creates an account,
    // and an account created outside this module must still land in the same log as one created
    // inside it. Exported so those modules record it rather than each keeping its own trail.
    AUTH_AUDIT_REPOSITORY,
  ],
})
export class AuthModule {}
