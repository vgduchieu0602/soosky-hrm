import type { Request, Response, NextFunction, CookieOptions } from 'express';
import { env } from '@config/env';
import { HttpError } from '@shared/errors/http-error';
import { authService } from '@features/iam/services/auth.service';
import { tokenService } from '@features/iam/services/token.service';
import { passwordSetupService } from '@features/iam/services/password-setup.service';
import type { LoginDto } from '@features/iam/dto/login.dto';
import type { ChangePasswordDto } from '@features/iam/dto/change-password.dto';
import type { SetPasswordDto } from '@features/iam/dto/set-password.dto';

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
      //Lấy thông tin đăng nhập từ request body
      const { identifier, password } = req.body as LoginDto;

      //Gọi AuthService.login để kiểm tra thông tin
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

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthenticated', 'IAM_002');
      const { currentPassword, newPassword } = req.body as ChangePasswordDto;
      const result = await authService.changePassword(
        req.user.userId,
        currentPassword,
        newPassword,
        req.user.sessionId,
      );
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
      const result = await passwordSetupService.check(token);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },

  /** Public — set the password using a single-use token from the email link. */
  async setPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body as SetPasswordDto;
      const result = await passwordSetupService.consume(token, password);
      res.json({ data: result, message: 'Thiết lập mật khẩu thành công' });
    } catch (err) {
      next(err);
    }
  },
};
