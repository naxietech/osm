import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { getAuthKeys } from '../../config/auth-keys';
import { loadAuthConfig } from '../../config/auth.config';
import type { AuthPrincipal } from '../principal';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const cookieName = loadAuthConfig(config).accessCookieName;
    super({
      // Prefer the access cookie; fall back to a Bearer header (tooling / tests).
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req.cookies as Record<string, string> | undefined)?.[cookieName] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: getAuthKeys(config).publicKey,
      algorithms: ['RS256'],
    });
  }

  validate(payload: AuthPrincipal): AuthPrincipal {
    return payload;
  }
}
