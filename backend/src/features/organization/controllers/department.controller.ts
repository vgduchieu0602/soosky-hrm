import type { Request, Response, NextFunction } from 'express';
import { departmentService } from '@features/organization/services/department.service';

function requireUser(req: Request) {
  if (!req.user) throw new Error('IAM_002');
  return req.user;
}

export const departmentController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const asTree = req.query.tree === 'true';
      res.json({ data: await departmentService.list(asTree) });
    } catch (err) { next(err); }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentService.findById(id) });
    } catch (err) { next(err); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      res.status(201).json({ data: await departmentService.create(req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentService.update(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentService.archive(id, user.userId) });
    } catch (err) { next(err); }
  },
  async assignHead(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentService.assignHead(id, req.body.managerId, user.userId) });
    } catch (err) { next(err); }
  },
  async move(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentService.move(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async transferEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentService.transferEmployees(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async merge(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentService.merge(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async history(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentService.history(id) });
    } catch (err) { next(err); }
  },
};
