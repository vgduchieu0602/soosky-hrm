import type { Request, Response, NextFunction, CookieOptions } from 'express';
import { env } from '@infra/config';
import { HttpError } from '@shared/errors/http-error';
import {
  authUseCases,
  userUseCases,
  roleUseCases,
  permissionUseCases,
  auditUseCases,
  passwordSetupUseCases,
  tokenService,
} from '@features/iam/container';
import type { LoginDto } from '@features/iam/dto/login.dto';
import type { ChangePasswordDto } from '@features/iam/dto/change-password.dto';
import type { SetPasswordDto } from '@features/iam/dto/set-password.dto';
import type { CreateUserDto } from '@features/iam/dto/create-user.dto';
import type { CreateRoleDto } from '@features/iam/dto/create-role.dto';
import type { CreatePermissionDto } from '@features/iam/dto/create-permission.dto';
import type { CreateUserInput, UpdateUserInput } from '@features/iam/application/user.usecases';
import type { CreateRoleInput, UpdateRoleInput } from '@features/iam/application/role.usecases';
import type { CreatePermissionInput, UpdatePermissionInput } from '@features/iam/application/permission.usecases';

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

export const userController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const input = req.body as CreateUserDto;
      const user = await userUseCases.create(input as CreateUserInput, req.user.userId);
      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const { id } = req.params as { id: string };
      const user = await userUseCases.findById(id);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const { status, search } = req.query;
      const users = await userUseCases.list({
        status: status as string | undefined,
        search: search as string | undefined,
      });
      res.json({ data: users });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const { id } = req.params as { id: string };
      const input = req.body as UpdateUserInput;
      const user = await userUseCases.update(id, input, req.user.userId);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const { id } = req.params as { id: string };
      const user = await userUseCases.delete(id, req.user.userId);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },
};

export const roleController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const input = req.body as CreateRoleDto;
      const role = await roleUseCases.create(input as CreateRoleInput, req.user.userId);
      res.status(201).json({ data: role });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const { id } = req.params as { id: string };
      const role = await roleUseCases.findById(id);
      res.json({ data: role });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const roles = await roleUseCases.list();
      res.json({ data: roles });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const { id } = req.params as { id: string };
      const input = req.body as UpdateRoleInput;
      const role = await roleUseCases.update(id, input, req.user.userId);
      res.json({ data: role });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const { id } = req.params as { id: string };
      const role = await roleUseCases.delete(id, req.user.userId);
      res.json({ data: role });
    } catch (err) {
      next(err);
    }
  },
};

export const permissionController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const input = req.body as CreatePermissionDto;
      const permission = await permissionUseCases.create(input as CreatePermissionInput, req.user.userId);
      res.status(201).json({ data: permission });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const { id } = req.params as { id: string };
      const permission = await permissionUseCases.findById(id);
      res.json({ data: permission });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const permissions = await permissionUseCases.list();
      res.json({ data: permissions });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const { id } = req.params as { id: string };
      const input = req.body as UpdatePermissionInput;
      const permission = await permissionUseCases.update(id, input, req.user.userId);
      res.json({ data: permission });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const { id } = req.params as { id: string };
      const permission = await permissionUseCases.delete(id, req.user.userId);
      res.json({ data: permission });
    } catch (err) {
      next(err);
    }
  },
};

export const auditController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const { resource, action, limit } = req.query;
      const data = await auditUseCases.list({
        resource: resource as string | undefined,
        action: action as string | undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
};
