import type { Request, Response, NextFunction } from 'express';
import { dashboardUseCases } from '@modules/hrm/adapters/container/dashboard';

export const dashboardController = {
  async overview(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await dashboardUseCases.overview();
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
};
