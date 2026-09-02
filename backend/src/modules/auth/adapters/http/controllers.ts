import type { Request, Response, NextFunction, CookieOptions } from 'express';
import { env } from '@infra/config';
import { HttpError } from '@shared/errors/http-error';
import {
  authUseCases,
  passwordSetupUseCases,
  tokenService,
} from '@modules/auth/adapters/container';
import type { LoginDto } from '@modules/auth/core/app/dto/login.dto';
import type { ChangePasswordDto } from '@modules/auth/core/app/dto/change-password.dto';
import type { SetPasswordDto } from '@modules/auth/core/app/dto/set-password.dto';


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
      const result = await authUseCases.login(identifier, password, clientCtx(req));
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
      const result = await authUseCases.refresh(raw, clientCtx(req));
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
      res.json({ data: { accessToken: result.accessToken } });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthenticated', 'IAM_002');
      await authUseCases.logout(req.user.userId, req.user.sessionId, clientCtx(req));
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
      res.json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthenticated', 'IAM_002');
      const user = await authUseCases.me(req.user.userId);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthenticated', 'IAM_002');
      const { currentPassword, newPassword } = req.body as ChangePasswordDto;
      const result = await authUseCases.changePassword(
        req.user.userId,
        currentPassword,
        newPassword,
        req.user.sessionId,
      );
      // Trả access token mới (đã bỏ cờ mustChangePassword) để client dùng ngay,
      // khỏi phải gọi refresh rồi mới vào được ứng dụng.
      res.json({ data: result, message: 'Đổi mật khẩu thành công' });
    } catch (err) {
      next(err);
    }
  },

  /** Public — validate a set-password/reset token before showing the form. */
  async checkSetupToken(req: Request, res: Response, next: NextFunction) {
    try {
      const token = (req.query.token as string | undefined)?.trim();
      if (!token) throw new HttpError(400, 'Thiếu token', 'IAM_011');
      const result = await passwordSetupUseCases.check(token);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },

  /** Public — set the password using a single-use token from the email link. */
  async setPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body as SetPasswordDto;
      const result = await passwordSetupUseCases.consume(token, password);
      res.json({ data: result, message: 'Thiết lập mật khẩu thành công' });
    } catch (err) {
      next(err);
    }
  },
};
