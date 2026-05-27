import type { Request, Response, NextFunction } from 'express';
import { userService, type CreateUserInput, type UpdateUserInput } from '@features/iam/services/user.service';
import type { CreateUserDto } from '@features/iam/dto/create-user.dto';

export const userController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });

      const input = req.body as CreateUserDto;
      const user = await userService.create(input as CreateUserInput, req.user.userId);
      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });

      const { id } = req.params as { id: string };
      const user = await userService.findById(id);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });

      const { status, search } = req.query;
      const users = await userService.list({
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
      const user = await userService.update(id, input, req.user.userId);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });

      const { id } = req.params as { id: string };
      const user = await userService.delete(id, req.user.userId);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },
};
