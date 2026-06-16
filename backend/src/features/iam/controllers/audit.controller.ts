import type { Request, Response, NextFunction } from 'express';
import { auditService } from '@features/iam/services/audit.service';

export const auditController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ code: 'IAM_002', message: 'Unauthenticated' });
      const { resource, action, limit } = req.query;
      const data = await auditService.list({
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
