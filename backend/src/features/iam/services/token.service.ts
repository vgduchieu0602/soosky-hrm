import jwt from 'jsonwebtoken';
import ms, { type StringValue } from 'ms';
import { env } from '@config/env';
import {
  accessTokenOptions,
  refreshTokenOptions,
  jwtSecrets,
  JWT_ISSUER,
  JWT_AUDIENCE,
} from '@config/jwt.config';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '@features/iam/types/jwt-payload.type';

interface SignAccessInput {
  userId: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
  mustChangePassword?: boolean;
}

interface SignRefreshInput {
  userId: string;
  sessionId: string;
  tokenVersion: number;
}

export const tokenService = {
  signAccess(input: SignAccessInput): string {
    const payload = {
      sessionId: input.sessionId,
      roles: input.roles,
      permissions: input.permissions,
      mustChangePassword: input.mustChangePassword,
    };
    return jwt.sign(payload, jwtSecrets.access, {
      ...accessTokenOptions,
      subject: input.userId,
    });
  },

  signRefresh(input: SignRefreshInput): string {
    const payload = {
      sessionId: input.sessionId,
      tokenVersion: input.tokenVersion,
    };
    return jwt.sign(payload, jwtSecrets.refresh, {
      ...refreshTokenOptions,
      subject: input.userId,
    });
  },

  verifyAccess(token: string): AccessTokenPayload {
    return jwt.verify(token, jwtSecrets.access, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as unknown as AccessTokenPayload;
  },

  verifyRefresh(token: string): RefreshTokenPayload {
    return jwt.verify(token, jwtSecrets.refresh, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as unknown as RefreshTokenPayload;
  },

  /** Refresh token TTL in milliseconds — shared by cookie maxAge & session.expiresAt. */
  refreshTtlMs(): number {
    return ms(env.JWT_REFRESH_TTL as StringValue);
  },
};
