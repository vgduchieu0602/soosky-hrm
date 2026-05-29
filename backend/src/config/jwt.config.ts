import type { SignOptions } from 'jsonwebtoken';
import { env } from '@config/env';

export const JWT_ISSUER = 'soosky-hrm';
export const JWT_AUDIENCE = 'soosky-hrm-client';

export const accessTokenOptions: SignOptions = {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
};

export const refreshTokenOptions: SignOptions = {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  expiresIn: env.JWT_REFRESH_TTL as SignOptions['expiresIn'],
};

export const jwtSecrets = {
  access: env.JWT_ACCESS_SECRET,
  refresh: env.JWT_REFRESH_SECRET,
};


