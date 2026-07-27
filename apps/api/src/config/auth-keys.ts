import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'node:crypto';

export interface AuthKeys {
  privateKey: string;
  publicKey: string;
}

let cached: AuthKeys | undefined;

/**
 * The RS256 key pair used to sign/verify access tokens. Loaded once per process.
 *
 * Production: set `JWT_PRIVATE_KEY_BASE64` / `JWT_PUBLIC_KEY_BASE64` (base64-encoded PEM)
 * so keys are stable across restarts and instances. Dev fallback: an ephemeral pair is
 * generated at boot — fine locally (tokens just don't survive a restart).
 */
export function getAuthKeys(config: ConfigService): AuthKeys {
  if (cached) return cached;

  const priv = config.get<string>('JWT_PRIVATE_KEY_BASE64');
  const pub = config.get<string>('JWT_PUBLIC_KEY_BASE64');
  if (priv && pub) {
    cached = {
      privateKey: Buffer.from(priv, 'base64').toString('utf8'),
      publicKey: Buffer.from(pub, 'base64').toString('utf8'),
    };
    return cached;
  }

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  new Logger('AuthKeys').warn(
    'JWT_PRIVATE_KEY_BASE64/JWT_PUBLIC_KEY_BASE64 not set — using an ephemeral RS256 key pair (dev only).',
  );
  cached = { privateKey, publicKey };
  return cached;
}

/** Test hook — forget the cached keys so a fresh pair is generated. */
export function resetAuthKeysCache(): void {
  cached = undefined;
}
