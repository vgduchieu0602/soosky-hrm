import type { Request, Response, NextFunction } from 'express';
import { leaveService } from '@features/attendance/services/leave.service';
import type { RejectLeaveDto, UpsertLeaveBalanceDto } from '@features/attendance/dto/leave.dto';

function userId(req: Request): string {
  if (!req.user) throw new Error('IAM_002');
  return req.user.userId;
}

export const leaveController = {
  // ---- employee (self) ----
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await leaveService.submit(userId(req), req.body) });
    } catch (e) {
      next(e);
    }
  },
  async mine(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await leaveService.mine(userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await leaveService.cancelOwn(userId(req), id) });
    } catch (e) {
      next(e);
    }
  },
  async myBalances(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await leaveService.myBalances(userId(req)) });
    } catch (e) {
      next(e);
    }
  },

  // ---- admin/HR ----
  async adminList(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await leaveService.adminList({ status: req.query.status as string | undefined }) });
    } catch (e) {
      next(e);
    }
  },
  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await leaveService.approve(id, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body as RejectLeaveDto;
      res.json({ data: await leaveService.reject(id, userId(req), reason) });
    } catch (e) {
      next(e);
    }
  },
  async adminBalances(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId } = req.params as { employeeId: string };
      const year = req.query.year ? Number(req.query.year) : undefined;
      res.json({ data: await leaveService.adminBalances(employeeId, year) });
    } catch (e) {
      next(e);
    }
  },
  async upsertBalance(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await leaveService.upsertBalance(req.body as UpsertLeaveBalanceDto, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
};
