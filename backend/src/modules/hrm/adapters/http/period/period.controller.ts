import type { Request, Response, NextFunction } from 'express';
import type { PeriodUseCases } from '@modules/hrm/core/period/app/period.usecases';

function userId(req: Request): string {
  if (!req.user) throw new Error('IAM_002');
  return req.user.userId;
}
const idParam = (req: Request) => (req.params as { id: string }).id;

export function createPeriodController(useCases: PeriodUseCases) {
  return {
    async list(_req: Request, res: Response, next: NextFunction) {
      try {
        res.json({ data: await useCases.list() });
      } catch (e) {
        next(e);
      }
    },
    async get(req: Request, res: Response, next: NextFunction) {
      try {
        res.json({ data: await useCases.get(idParam(req)) });
      } catch (e) {
        next(e);
      }
    },
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        res.status(201).json({ data: await useCases.create(req.body, userId(req)) });
      } catch (e) {
        next(e);
      }
    },
    async update(req: Request, res: Response, next: NextFunction) {
      try {
        res.json({ data: await useCases.update(idParam(req), req.body, userId(req)) });
      } catch (e) {
        next(e);
      }
    },
    async close(req: Request, res: Response, next: NextFunction) {
      try {
        res.json({ data: await useCases.close(idParam(req), userId(req)) });
      } catch (e) {
        next(e);
      }
    },
    async attendanceReadiness(req: Request, res: Response, next: NextFunction) {
      try {
        res.json({ data: await useCases.attendanceReadiness(idParam(req)) });
      } catch (e) {
        next(e);
      }
    },
    async lockAttendance(req: Request, res: Response, next: NextFunction) {
      try {
        res.json({ data: await useCases.lockAttendance(idParam(req), userId(req)) });
      } catch (e) {
        next(e);
      }
    },
    async unlockAttendance(req: Request, res: Response, next: NextFunction) {
      try {
        res.json({ data: await useCases.unlockAttendance(idParam(req), userId(req)) });
      } catch (e) {
        next(e);
      }
    },
    async performanceReadiness(req: Request, res: Response, next: NextFunction) {
      try {
        res.json({ data: await useCases.performanceReadiness(idParam(req)) });
      } catch (e) {
        next(e);
      }
    },
    async lockPerformance(req: Request, res: Response, next: NextFunction) {
      try {
        res.json({ data: await useCases.lockPerformance(idParam(req), userId(req)) });
      } catch (e) {
        next(e);
      }
    },
    async unlockPerformance(req: Request, res: Response, next: NextFunction) {
      try {
        res.json({ data: await useCases.unlockPerformance(idParam(req), userId(req)) });
      } catch (e) {
        next(e);
      }
    },
    async reopen(req: Request, res: Response, next: NextFunction) {
      try {
        res.json({ data: await useCases.reopen(idParam(req), userId(req)) });
      } catch (e) {
        next(e);
      }
    },
    async remove(req: Request, res: Response, next: NextFunction) {
      try {
        res.json({ data: await useCases.remove(idParam(req), userId(req)) });
      } catch (e) {
        next(e);
      }
    },
  };
}
