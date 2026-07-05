import type { Request, Response, NextFunction } from 'express';
import { parsePagination, buildMeta } from '@shared/utils/pagination.util';
import type { PaginationQuery } from '@shared/types/pagination.type';
import type { GrossUpDto } from '@features/payroll/dto/gross-up.dto';
import {
  payrollPeriodUseCases,
  payrollUseCases,
  allowanceUseCases,
  bonusUseCases,
  deductionUseCases,
  taxProfileUseCases,
  runPayrollForEmployee,
  runPayrollForPeriod,
  approvePayroll,
  revertPayrollToDraft,
  markPeriodPaid,
} from '@features/payroll/container';

function userId(req: Request): string {
  if (!req.user) throw new Error('IAM_002');
  return req.user.userId;
}

const employeeIdParam = (req: Request) => (req.params as { employeeId: string }).employeeId;
const idParam = (req: Request) => (req.params as { id: string }).id;

// ============================ Payroll periods ============================
export const payrollPeriodController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await payrollPeriodUseCases.list() });
    } catch (e) {
      next(e);
    }
  },
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await payrollPeriodUseCases.get(idParam(req)) });
    } catch (e) {
      next(e);
    }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await payrollPeriodUseCases.create(req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await payrollPeriodUseCases.update(idParam(req), req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async close(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await payrollPeriodUseCases.close(idParam(req), userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async attendanceReadiness(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await payrollPeriodUseCases.attendanceReadiness(idParam(req)) });
    } catch (e) {
      next(e);
    }
  },
  async reopen(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await payrollPeriodUseCases.reopen(idParam(req), userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await payrollPeriodUseCases.remove(idParam(req), userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async lockAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await payrollPeriodUseCases.lockAttendance(idParam(req), userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async unlockAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await payrollPeriodUseCases.unlockAttendance(idParam(req), userId(req)) });
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

// ============================ Computed payrolls ============================
export const payrollController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query as PaginationQuery);
      const { items, total } = await payrollUseCases.paginate(
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
      const roles = req.user?.roles ?? [];
      const isHrOrAdmin = roles.includes('admin') || roles.includes('hr_manager');
      res.json({ data: await payrollUseCases.get(id, { userId: userId(req), isHrOrAdmin }) });
    } catch (e) {
      next(e);
    }
  },
  async preflight(req: Request, res: Response, next: NextFunction) {
    try {
      const { periodId } = req.params as { periodId: string };
      res.json({ data: await payrollUseCases.preflight(periodId) });
    } catch (e) {
      next(e);
    }
  },
  async exportPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const { periodId } = req.params as { periodId: string };
      const buf = await payrollUseCases.exportPeriodXlsx(periodId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="bang-luong.xlsx"');
      res.send(buf);
    } catch (e) {
      next(e);
    }
  },
  async mine(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await payrollUseCases.listMine(userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async totals(req: Request, res: Response, next: NextFunction) {
    try {
      const { periodId } = req.params as { periodId: string };
      res.json({ data: await payrollUseCases.totals(periodId) });
    } catch (e) {
      next(e);
    }
  },

  /** POST /payroll/gross-up — NET → GROSS calculator. */
  async grossUp(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await payrollUseCases.grossUp(req.body as GrossUpDto) });
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

// ============================ Compensation ============================
export const compensationController = {
  // ---- Allowance ----
  async listAllowances(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await allowanceUseCases.listByEmployee(employeeIdParam(req)) });
    } catch (e) {
      next(e);
    }
  },
  async createAllowance(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await allowanceUseCases.create(req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async updateAllowance(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await allowanceUseCases.update(idParam(req), req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async removeAllowance(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await allowanceUseCases.remove(idParam(req), userId(req)) });
    } catch (e) {
      next(e);
    }
  },

  // ---- Bonus ----
  async listBonuses(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await bonusUseCases.listByEmployee(employeeIdParam(req)) });
    } catch (e) {
      next(e);
    }
  },
  async createBonus(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await bonusUseCases.create(req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async updateBonus(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await bonusUseCases.update(idParam(req), req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async removeBonus(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await bonusUseCases.remove(idParam(req), userId(req)) });
    } catch (e) {
      next(e);
    }
  },

  // ---- Deduction ----
  async listDeductions(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await deductionUseCases.listByEmployee(employeeIdParam(req)) });
    } catch (e) {
      next(e);
    }
  },
  async createDeduction(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await deductionUseCases.create(req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async updateDeduction(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await deductionUseCases.update(idParam(req), req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async removeDeduction(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await deductionUseCases.remove(idParam(req), userId(req)) });
    } catch (e) {
      next(e);
    }
  },

  // ---- Tax profile ----
  async listTaxProfiles(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await taxProfileUseCases.listByEmployee(employeeIdParam(req)) });
    } catch (e) {
      next(e);
    }
  },
  async upsertTaxProfile(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await taxProfileUseCases.upsert(req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
};
