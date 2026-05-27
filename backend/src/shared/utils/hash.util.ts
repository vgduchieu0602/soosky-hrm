import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { env } from '@config/env';

/**
 * Single entry point for password / token hashing.
 * Services & models MUST NOT import bcrypt directly.
 */
export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, env.BCRYPT_ROUND);

export const comparePassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

/**
 * Refresh tokens are stored hashed in `sessions.refreshTokenHash`.
 * SHA-256 is sufficient and is much faster than bcrypt for tokens that are
 * already cryptographically random (signed JWT).
 */
export const hashRefreshToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export const compareRefreshToken = (plain: string, hash: string): boolean =>
  crypto.timingSafeEqual(Buffer.from(hashRefreshToken(plain)), Buffer.from(hash));
