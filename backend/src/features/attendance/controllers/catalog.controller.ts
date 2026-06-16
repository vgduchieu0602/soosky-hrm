import type { Request, Response, NextFunction } from 'express';
import {
  shiftService,
  holidayService,
  symbolService,
} from '@features/attendance/services/catalog.service';

function userId(req: Request) {
  if (!req.user) throw new Error('IAM_002');
  return req.user.userId;
}

export const catalogController = {
  // shifts
  async listShifts(_req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await shiftService.list() }); } catch (e) { next(e); }
  },
  async createShift(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ data: await shiftService.create(req.body, userId(req)) }); } catch (e) { next(e); }
  },
  async updateShift(req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await shiftService.update((req.params as { id: string }).id, req.body, userId(req)) }); } catch (e) { next(e); }
  },

  // holidays
  async listHolidays(_req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await holidayService.list() }); } catch (e) { next(e); }
  },
  async createHoliday(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ data: await holidayService.create(req.body, userId(req)) }); } catch (e) { next(e); }
  },
  async updateHoliday(req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await holidayService.update((req.params as { id: string }).id, req.body, userId(req)) }); } catch (e) { next(e); }
  },
  async removeHoliday(req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await holidayService.remove((req.params as { id: string }).id, userId(req)) }); } catch (e) { next(e); }
  },

  // symbols
  async listSymbols(_req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await symbolService.list() }); } catch (e) { next(e); }
  },
  async createSymbol(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ data: await symbolService.create(req.body, userId(req)) }); } catch (e) { next(e); }
  },
  async updateSymbol(req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await symbolService.update((req.params as { id: string }).id, req.body, userId(req)) }); } catch (e) { next(e); }
  },
};
