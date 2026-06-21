import type { Request, Response, NextFunction } from 'express';
import { parsePagination, buildMeta } from '@shared/utils/pagination.util';
import type { PaginationQuery } from '@shared/types/pagination.type';
import { payrollService } from '@features/payroll/services/payroll.service';
import {
  approvePayroll,
  markPeriodPaid,
  revertPayrollToDraft,
} from '@features/payroll/services/payroll-approval.service';
import type { GrossUpDto } from '@features/payroll/dto/gross-up.dto';

function userId(req: Request): string {
  if (!req.user) throw new Error('IAM_002');
  return req.user.userId;
}

export const payrollController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query as PaginationQuery);
      const { items, total } = await payrollService.paginate(
        {
          payrollPeriodId: req.query.payrollPeriodId as string | undefined,
          employeeId: req.query.employeeId as string | undefined,
          status: req.query.status as string | undefined,
        },
        page,
        limit,
      );
      res.json({ data: items, meta: buildMeta(page, limit, total) });
    } catch (e) {
      next(e);
    }
  },
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await payrollService.get(id) });
    } catch (e) {
      next(e);
    }
  },
  async mine(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await payrollService.listMine(userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async totals(req: Request, res: Response, next: NextFunction) {
    try {
      const { periodId } = req.params as { periodId: string };
      res.json({ data: await payrollService.totals(periodId) });
    } catch (e) {
      next(e);
    }
  },

  /** POST /payroll/gross-up — NET → GROSS calculator. */
  async grossUp(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await payrollService.grossUp(req.body as GrossUpDto) });
    } catch (e) {
      next(e);
    }
  },

  // ---- Workflow: approve → pay ----
  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const { employeeId } = req.body as { employeeId?: string };
      res.json({ data: await approvePayroll(id, userId(req), employeeId) });
    } catch (e) {
      next(e);
    }
  },
  async revert(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await revertPayrollToDraft(id, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async markPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await markPeriodPaid(id, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
};
