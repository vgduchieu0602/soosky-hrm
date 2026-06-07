import type { Request, Response, NextFunction } from 'express';
import { positionService } from '@features/organization/services/position.service';

function requireUser(req: Request) {
  if (!req.user) throw new Error('IAM_002');
  return req.user;
}

export const positionController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const departmentId = req.query.departmentId as string | undefined;
      res.json({ data: await positionService.list({ departmentId }) });
    } catch (err) { next(err); }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await positionService.findById(id) });
    } catch (err) { next(err); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      res.status(201).json({ data: await positionService.create(req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await positionService.update(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await positionService.remove(id, user.userId) });
    } catch (err) { next(err); }
  },
};
