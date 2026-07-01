import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { HttpError } from '@shared/errors/http-error';
import { jwtSecrets, JWT_ISSUER, JWT_AUDIENCE } from '@config/jwt.config';
import type { AccessTokenPayload } from '@features/iam/types/jwt-payload.type';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization');

  if (!header?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Missing access token', 'IAM_002'));
  }

  try {
    const payload = jwt.verify(header.slice(7), jwtSecrets.access, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as unknown as AccessTokenPayload;

    req.user = {
      userId: payload.sub,
      roles: payload.roles,
      permissions: payload.permissions,
      mustChangePassword: payload.mustChangePassword,
      sessionId: payload.sessionId,
    };

    // Enforce forced password change server-side: a user flagged
    // mustChangePassword may only change their password, read self, or log out —
    // every other API is blocked until they resolve it (UI gating is not enough).
    if (payload.mustChangePassword && !isPasswordChangeAllowed(req.path)) {
      return next(new HttpError(403, 'Phải đổi mật khẩu trước khi tiếp tục', 'IAM_013'));
    }
    next();
  } catch {
    next(new HttpError(401, 'Access token invalid or expired', 'IAM_002'));
  }
}

const MUST_CHANGE_ALLOWLIST = ['/auth/change-password', '/auth/logout', '/auth/me'];

function isPasswordChangeAllowed(path: string): boolean {
  return MUST_CHANGE_ALLOWLIST.some((p) => path === p || path.endsWith(p));
}
