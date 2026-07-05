import type { Request, Response, NextFunction } from 'express';
import { dashboardService } from '@features/dashboard/dashboard.service';

export const dashboardController = {
  async overview(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.overview();
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
};
