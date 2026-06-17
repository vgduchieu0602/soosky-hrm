import type { Request, Response, NextFunction } from 'express';
import { attendanceService } from '@features/attendance/services/attendance.service';

function userId(req: Request): string {
  if (!req.user) throw new Error('IAM_002');
  return req.user.userId;
}

function currentMonthVN(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  return `${y}-${m}`;
}

function month(req: Request): string {
  const q = (req.query.month as string | undefined)?.trim();
  return q && /^\d{4}-\d{2}$/.test(q) ? q : currentMonthVN();
}

export const attendanceController = {
  async myMonth(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await attendanceService.myMonth(userId(req), month(req)) });
    } catch (e) {
      next(e);
    }
  },
  async adminGrid(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({
        data: await attendanceService.adminGrid({
          month: month(req),
          departmentId: req.query.departmentId as string | undefined,
          q: req.query.q as string | undefined,
        }),
      });
    } catch (e) {
      next(e);
    }
  },
  async upsert(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await attendanceService.upsert(req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async bulkUpsert(req: Request, res: Response, next: NextFunction) {
    try {
      const { rows } = req.body as { rows: Parameters<typeof attendanceService.bulkUpsert>[0] };
      res.json({ data: await attendanceService.bulkUpsert(rows, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async adjust(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await attendanceService.adjust(id, req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await attendanceService.remove(id, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
};
