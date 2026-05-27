import type { SignOptions } from 'jsonwebtoken';
import { env } from '@config/env';

/**
 * Centralize JWT sign/verify options.
 * Any code that signs or verifies a JWT MUST import from this file —
 * never pass secret/TTL inline. This keeps key-rotation a one-file change.
 */
export const JWT_ISSUER = 'soosky-hrm';
export const JWT_AUDIENCE = 'soosky-hrm-client';

export const accessTokenOptions: SignOptions = {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
};

export const refreshTokenOptions: SignOptions = {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
};

export const jwtSecrets = {
  access: env.JWT_ACCESS_SECRET,
  refresh: env.JWT_REFRESH_SECRET,
};
