import type { Request, Response, NextFunction } from 'express';
import { payrollPeriodService } from '@features/payroll/services/payroll-period.service';
import {
  runPayrollForEmployee,
  runPayrollForPeriod,
} from '@features/payroll/services/payroll-run.service';

function userId(req: Request): string {
  if (!req.user) throw new Error('IAM_002');
  return req.user.userId;
}

export const payrollPeriodController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await payrollPeriodService.list() });
    } catch (e) {
      next(e);
    }
  },
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await payrollPeriodService.get(id) });
    } catch (e) {
      next(e);
    }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await payrollPeriodService.create(req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await payrollPeriodService.update(id, req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async close(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await payrollPeriodService.close(id, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async attendanceReadiness(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await payrollPeriodService.attendanceReadiness(id) });
    } catch (e) {
      next(e);
    }
  },
  async lockAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await payrollPeriodService.lockAttendance(id, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async unlockAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      res.json({ data: await payrollPeriodService.unlockAttendance(id, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  // ---- Run triggers ----
  async runPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const { requireApprovedEvaluation } = req.body as { requireApprovedEvaluation?: boolean };
      res.json({ data: await runPayrollForPeriod(id, { requireApprovedEvaluation }) });
    } catch (e) {
      next(e);
    }
  },
  async runEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, employeeId } = req.params as { id: string; employeeId: string };
      res.json({ data: await runPayrollForEmployee(id, employeeId) });
    } catch (e) {
      next(e);
    }
  },
};
