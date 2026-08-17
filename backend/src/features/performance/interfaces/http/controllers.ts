import type { Request, Response, NextFunction } from 'express';
import { criterionUseCases, evaluationUseCases } from '@features/performance/container';

function userId(req: Request): string {
  if (!req.user) throw new Error('IAM_002');
  return req.user.userId;
}
const idOf = (req: Request) => (req.params as { id: string }).id;

export const evaluationController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await evaluationUseCases.list(req.query.payrollPeriodId as string | undefined) });
    } catch (e) {
      next(e);
    }
  },
  async mine(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await evaluationUseCases.listMine(userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async byEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId } = req.params as { employeeId: string };
      res.json({ data: await evaluationUseCases.listByEmployee(employeeId) });
    } catch (e) {
      next(e);
    }
  },
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const roles = req.user?.roles ?? [];
      const isHrOrAdmin = roles.includes('admin') || roles.includes('hr_manager');
      res.json({ data: await evaluationUseCases.get(idOf(req), { userId: userId(req), isHrOrAdmin }) });
    } catch (e) {
      next(e);
    }
  },
  /** Direct evaluate: list NV → click → chấm → Lưu nháp / Duyệt. */
  async evaluate(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await evaluationUseCases.directEvaluate(req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async acknowledge(req: Request, res: Response, next: NextFunction) {
    try {
      const { disputeNote } = req.body as { disputeNote?: string };
      res.json({ data: await evaluationUseCases.acknowledge(idOf(req), disputeNote, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async reopen(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body as { reason?: string };
      res.json({ data: await evaluationUseCases.reopen(idOf(req), userId(req), reason) });
    } catch (e) {
      next(e);
    }
  },
  async exportXlsx(req: Request, res: Response, next: NextFunction) {
    try {
      const buf = await evaluationUseCases.exportXlsx((req.query as { payrollPeriodId?: string }).payrollPeriodId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="danh-gia.xlsx"');
      res.send(buf);
    } catch (e) {
      next(e);
    }
  },
};

export const criterionController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const group = (req.query as { group?: 'performance' | 'goal' }).group;
      res.json({ data: await criterionUseCases.list(group) });
    } catch (e) {
      next(e);
    }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await criterionUseCases.create(req.body) });
    } catch (e) {
      next(e);
    }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await criterionUseCases.update(idOf(req), req.body) });
    } catch (e) {
      next(e);
    }
  },
  async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await criterionUseCases.deactivate(idOf(req)) });
    } catch (e) {
      next(e);
    }
  },
};
