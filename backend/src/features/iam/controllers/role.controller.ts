import type { Request, Response, NextFunction } from 'express';
import { roleService, type CreateRoleInput, type UpdateRoleInput } from '@features/iam/services/role.service';
import type { CreateRoleDto } from '@features/iam/dto/create-role.dto';

export const roleController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });

      const input = req.body as CreateRoleDto;
      const role = await roleService.create(input as CreateRoleInput, req.user.userId);
      res.status(201).json({ data: role.toJSON() });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });

      const { id } = req.params as { id: string };
      const role = await roleService.findById(id);
      res.json({ data: role });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });

      const roles = await roleService.list();
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
      const role = await roleService.update(id, input, req.user.userId);
      res.json({ data: role.toJSON() });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });

      const { id } = req.params as { id: string };
      const role = await roleService.delete(id, req.user.userId);
      res.json({ data: role.toJSON() });
    } catch (err) {
      next(err);
    }
  },
};
