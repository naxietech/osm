import { Algorithm, hash, verify } from '@node-rs/argon2';

/**
 * Password hashing — argon2id with OWASP-recommended parameters
 * (19 MiB memory, 2 iterations, 1 lane). The hash string carries its own
 * parameters, so `verifyPassword` works even after these are later tuned up.
 */
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  return verify(storedHash, plain);
}
