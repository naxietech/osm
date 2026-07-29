import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync } from 'node:crypto';

import { UserRole } from '@oses/types';

import type { AuthConfig } from '../../config/auth.config';
import { TokenService } from './token.service';

const config = { accessTtl: '15m' } as AuthConfig;

function makeService(): TokenService {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const jwt = new JwtService({
    privateKey,
    publicKey,
    signOptions: { algorithm: 'RS256' },
    verifyOptions: { algorithms: ['RS256'] },
  });
  return new TokenService(jwt, config);
}

describe('TokenService', () => {
  it('signs and verifies an RS256 access token round-trip, preserving roleId', () => {
    const svc = makeService();
    const token = svc.signAccessToken({
      sub: 'u1',
      email: 'admin@oses.pk',
      role: UserRole.ADMIN,
      roleId: 'role_super_admin',
    });
    const claims = svc.verifyAccessToken(token);
    expect(claims.sub).toBe('u1');
    expect(claims.roleId).toBe('role_super_admin');
    expect(claims.role).toBe(UserRole.ADMIN);
  });

  it('generates an opaque refresh token whose sha256 hash matches hashRefreshToken', () => {
    const svc = makeService();
    const { token, hash } = svc.generateRefreshToken();
    expect(token.length).toBeGreaterThan(20);
    expect(hash).toHaveLength(64);
    expect(svc.hashRefreshToken(token)).toBe(hash);
  });
});
