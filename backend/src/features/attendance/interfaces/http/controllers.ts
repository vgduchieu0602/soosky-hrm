import type { Request, Response, NextFunction } from 'express';
import { TIMEZONE } from '@features/attendance/domain/attendance-calc';
import {
  attendanceUseCases,
  leaveUseCases,
  shiftUseCases,
  holidayUseCases,
  symbolUseCases,
} from '@features/attendance/container';
import type { UpsertAttendanceDto } from '@features/attendance/dto/attendance.dto';
import type { RejectLeaveDto, UpsertLeaveBalanceDto } from '@features/attendance/dto/leave.dto';

function userId(req: Request): string {
  if (!req.user) throw new Error('IAM_002');
  return req.user.userId;
}

function currentMonthVN(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
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
      res.json({ data: await attendanceUseCases.myMonth(userId(req), month(req)) });
    } catch (e) { next(e); }
  },
  async adminGrid(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({
        data: await attendanceUseCases.adminGrid({
          month: month(req),
          departmentId: req.query.departmentId as string | undefined,
          q: req.query.q as string | undefined,
        }),
      });
    } catch (e) { next(e); }
  },
  async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await attendanceUseCases.punch(userId(req), 'in') });
    } catch (e) { next(e); }
  },
  async checkOut(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await attendanceUseCases.punch(userId(req), 'out') });
    } catch (e) { next(e); }
  },
  async upsert(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await attendanceUseCases.upsert(req.body, userId(req)) });
    } catch (e) { next(e); }
  },
  async bulkUpsert(req: Request, res: Response, next: NextFunction) {
    try {
      const { rows } = req.body as { rows: UpsertAttendanceDto[] };
      res.json({ data: await attendanceUseCases.bulkUpsert(rows, userId(req)) });
    } catch (e) { next(e); }
  },
  async adjust(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await attendanceUseCases.adjust(id, req.body, userId(req)) });
    } catch (e) { next(e); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await attendanceUseCases.remove(id, userId(req)) });
    } catch (e) { next(e); }
  },
};

export const leaveController = {
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await leaveUseCases.submit(userId(req), req.body) });
    } catch (e) { next(e); }
  },
  async mine(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await leaveUseCases.mine(userId(req)) });
    } catch (e) { next(e); }
  },
  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await leaveUseCases.cancelOwn(userId(req), id) });
    } catch (e) { next(e); }
  },
  async myBalances(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await leaveUseCases.myBalances(userId(req)) });
    } catch (e) { next(e); }
  },
  async adminList(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await leaveUseCases.adminList({ status: req.query.status as string | undefined }) });
    } catch (e) { next(e); }
  },
  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await leaveUseCases.approve(id, userId(req)) });
    } catch (e) { next(e); }
  },
  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body as RejectLeaveDto;
      res.json({ data: await leaveUseCases.reject(id, userId(req), reason) });
    } catch (e) { next(e); }
  },
  async revoke(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const { reason } = (req.body ?? {}) as { reason?: string };
      res.json({ data: await leaveUseCases.revoke(id, userId(req), reason) });
    } catch (e) { next(e); }
  },
  async adminBalances(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId } = req.params as { employeeId: string };
      const year = req.query.year ? Number(req.query.year) : undefined;
      res.json({ data: await leaveUseCases.adminBalances(employeeId, year) });
    } catch (e) { next(e); }
  },
  async upsertBalance(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await leaveUseCases.upsertBalance(req.body as UpsertLeaveBalanceDto, userId(req)) });
    } catch (e) { next(e); }
  },
};

export const catalogController = {
  // shifts
  async listShifts(_req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await shiftUseCases.list() }); } catch (e) { next(e); }
  },
  async createShift(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ data: await shiftUseCases.create(req.body, userId(req)) }); } catch (e) { next(e); }
  },
  async updateShift(req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await shiftUseCases.update((req.params as { id: string }).id, req.body, userId(req)) }); } catch (e) { next(e); }
  },
  async removeShift(req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await shiftUseCases.remove((req.params as { id: string }).id, userId(req)) }); } catch (e) { next(e); }
  },
  // holidays
  async listHolidays(_req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await holidayUseCases.list() }); } catch (e) { next(e); }
  },
  async createHoliday(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ data: await holidayUseCases.create(req.body, userId(req)) }); } catch (e) { next(e); }
  },
  async updateHoliday(req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await holidayUseCases.update((req.params as { id: string }).id, req.body, userId(req)) }); } catch (e) { next(e); }
  },
  async removeHoliday(req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await holidayUseCases.remove((req.params as { id: string }).id, userId(req)) }); } catch (e) { next(e); }
  },
  // symbols
  async listSymbols(_req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await symbolUseCases.list() }); } catch (e) { next(e); }
  },
  async createSymbol(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ data: await symbolUseCases.create(req.body, userId(req)) }); } catch (e) { next(e); }
  },
  async updateSymbol(req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await symbolUseCases.update((req.params as { id: string }).id, req.body, userId(req)) }); } catch (e) { next(e); }
  },
  async removeSymbol(req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await symbolUseCases.remove((req.params as { id: string }).id, userId(req)) }); } catch (e) { next(e); }
  },
};
