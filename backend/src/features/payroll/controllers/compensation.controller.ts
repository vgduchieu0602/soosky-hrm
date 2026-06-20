import type { Request, Response, NextFunction } from 'express';
import {
  allowanceService,
  bonusService,
  deductionService,
  taxProfileService,
} from '@features/payroll/services/compensation.service';

function userId(req: Request): string {
  if (!req.user) throw new Error('IAM_002');
  return req.user.userId;
}

const employeeIdParam = (req: Request) => (req.params as { employeeId: string }).employeeId;
const idParam = (req: Request) => (req.params as { id: string }).id;

export const compensationController = {
  // ---- Allowance ----
  async listAllowances(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await allowanceService.listByEmployee(employeeIdParam(req)) });
    } catch (e) {
      next(e);
    }
  },
  async createAllowance(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await allowanceService.create(req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async updateAllowance(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await allowanceService.update(idParam(req), req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async removeAllowance(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await allowanceService.remove(idParam(req), userId(req)) });
    } catch (e) {
      next(e);
    }
  },

  // ---- Bonus ----
  async listBonuses(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await bonusService.listByEmployee(employeeIdParam(req)) });
    } catch (e) {
      next(e);
    }
  },
  async createBonus(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await bonusService.create(req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async updateBonus(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await bonusService.update(idParam(req), req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async removeBonus(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await bonusService.remove(idParam(req), userId(req)) });
    } catch (e) {
      next(e);
    }
  },

  // ---- Deduction ----
  async listDeductions(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await deductionService.listByEmployee(employeeIdParam(req)) });
    } catch (e) {
      next(e);
    }
  },
  async createDeduction(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await deductionService.create(req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async updateDeduction(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await deductionService.update(idParam(req), req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async removeDeduction(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await deductionService.remove(idParam(req), userId(req)) });
    } catch (e) {
      next(e);
    }
  },

  // ---- Tax profile ----
  async listTaxProfiles(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await taxProfileService.listByEmployee(employeeIdParam(req)) });
    } catch (e) {
      next(e);
    }
  },
  async upsertTaxProfile(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await taxProfileService.upsert(req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
};
