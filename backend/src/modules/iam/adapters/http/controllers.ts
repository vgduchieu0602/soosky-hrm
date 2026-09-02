import type { Request, Response, NextFunction } from 'express';
import {
  userUseCases,
  roleUseCases,
  permissionUseCases,
  auditUseCases,
} from '@modules/iam/adapters/container';
import type { CreateUserDto } from '@modules/iam/core/app/dto/create-user.dto';
import type { CreateRoleDto } from '@modules/iam/core/app/dto/create-role.dto';
import type { CreatePermissionDto } from '@modules/iam/core/app/dto/create-permission.dto';
import type { CreateUserInput, UpdateUserInput } from '@modules/iam/core/app/use-cases/user.usecases';
import type { CreateRoleInput, UpdateRoleInput } from '@modules/iam/core/app/use-cases/role.usecases';
import type { CreatePermissionInput, UpdatePermissionInput } from '@modules/iam/core/app/use-cases/permission.usecases';

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
