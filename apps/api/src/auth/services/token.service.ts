import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';

import { AUTH_CONFIG, type AuthConfig } from '../../config/auth.config';
import type { AuthPrincipal } from '../principal';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  /** Sign a short-lived RS256 access token (algorithm + keys come from JwtModule). */
  signAccessToken(claims: AuthPrincipal): string {
    return this.jwt.sign(claims, { expiresIn: this.config.accessTtl });
  }

  verifyAccessToken(token: string): AuthPrincipal {
    return this.jwt.verify<AuthPrincipal>(token);
  }

  /** A new opaque refresh token and the sha256 hash to persist (never store the token). */
  generateRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hashRefreshToken(token) };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
