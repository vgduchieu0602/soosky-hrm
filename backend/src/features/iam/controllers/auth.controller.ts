import type { Request, Response, NextFunction, CookieOptions } from 'express';
import { env } from '@config/env';
import { HttpError } from '@shared/errors/http-error';
import { authService } from '@features/iam/services/auth.service';
import { tokenService } from '@features/iam/services/token.service';
import type { LoginDto } from '@features/iam/dto/login.dto';

const REFRESH_COOKIE_NAME = 'refreshToken';

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: tokenService.refreshTtlMs(),
  };
}

function clientCtx(req: Request) {
  return {
    ip: req.ip,
    userAgent: req.header('user-agent') ?? undefined,
  };
}

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { identifier, password } = req.body as LoginDto;
      const result = await authService.login(identifier, password, clientCtx(req));
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
      res.json({
        data: {
          accessToken: result.accessToken,
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const raw = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
      const result = await authService.refresh(raw, clientCtx(req));
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
      res.json({ data: { accessToken: result.accessToken } });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthenticated', 'IAM_002');
      await authService.logout(req.user.userId, req.user.sessionId, clientCtx(req));
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
      res.json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthenticated', 'IAM_002');
      const user = await authService.me(req.user.userId);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },
};
