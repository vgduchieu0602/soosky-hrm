import type { Request, Response, NextFunction } from 'express';
import { departmentUseCases, positionUseCases } from '@modules/hrm/adapters/container/organization';

function requireUser(req: Request) {
  if (!req.user) throw new Error('IAM_002');
  return req.user;
}

export const departmentController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const asTree = req.query.tree === 'true';
      res.json({ data: await departmentUseCases.list(asTree) });
    } catch (err) { next(err); }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentUseCases.findById(id) });
    } catch (err) { next(err); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      res.status(201).json({ data: await departmentUseCases.create(req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentUseCases.update(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentUseCases.archive(id, user.userId) });
    } catch (err) { next(err); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentUseCases.remove(id, user.userId) });
    } catch (err) { next(err); }
  },
  async assignHead(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentUseCases.assignHead(id, req.body.managerId, user.userId) });
    } catch (err) { next(err); }
  },
  async move(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentUseCases.move(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async transferEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentUseCases.transferEmployees(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async merge(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentUseCases.merge(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async history(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await departmentUseCases.history(id) });
    } catch (err) { next(err); }
  },
};

export const positionController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const departmentId = req.query.departmentId as string | undefined;
      const status = req.query.status as string | undefined;
      res.json({ data: await positionUseCases.list({ departmentId, status }) });
    } catch (err) { next(err); }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await positionUseCases.findById(id) });
    } catch (err) { next(err); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      res.status(201).json({ data: await positionUseCases.create(req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await positionUseCases.update(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await positionUseCases.archive(id, user.userId) });
    } catch (err) { next(err); }
  },
};
