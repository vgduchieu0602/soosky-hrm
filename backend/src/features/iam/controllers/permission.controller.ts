import type { Request, Response, NextFunction } from 'express';
import { permissionService, type CreatePermissionInput, type UpdatePermissionInput } from '@features/iam/services/permission.service';
import type { CreatePermissionDto } from '@features/iam/dto/create-permission.dto';

export const permissionController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });

      const input = req.body as CreatePermissionDto;
      const permission = await permissionService.create(input as CreatePermissionInput, req.user.userId);
      res.status(201).json({ data: permission.toJSON() });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });

      const { id } = req.params as { id: string };
      const permission = await permissionService.findById(id);
      res.json({ data: permission.toJSON() });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });

      const permissions = await permissionService.list();
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
      const permission = await permissionService.update(id, input, req.user.userId);
      res.json({ data: permission.toJSON() });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });

      const { id } = req.params as { id: string };
      const permission = await permissionService.delete(id, req.user.userId);
      res.json({ data: permission.toJSON() });
    } catch (err) {
      next(err);
    }
  },
};
