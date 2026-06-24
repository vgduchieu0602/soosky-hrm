import type { Request, Response, NextFunction } from 'express';
import { evaluationService } from '@features/performance/services/evaluation.service';

function userId(req: Request): string {
  if (!req.user) throw new Error('IAM_002');
  return req.user.userId;
}
const idOf = (req: Request) => (req.params as { id: string }).id;

export const evaluationController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await evaluationService.list(req.query.payrollPeriodId as string | undefined) });
    } catch (e) {
      next(e);
    }
  },
  async mine(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await evaluationService.listMine(userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async byEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId } = req.params as { employeeId: string };
      res.json({ data: await evaluationService.listByEmployee(employeeId) });
    } catch (e) {
      next(e);
    }
  },
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const roles = req.user?.roles ?? [];
      const isHrOrAdmin = roles.includes('admin') || roles.includes('hr_manager');
      res.json({ data: await evaluationService.get(idOf(req), { userId: userId(req), isHrOrAdmin }) });
    } catch (e) {
      next(e);
    }
  },
  /** Direct evaluate: list NV → click → chấm → Lưu nháp / Duyệt. */
  async evaluate(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ data: await evaluationService.directEvaluate(req.body, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async acknowledge(req: Request, res: Response, next: NextFunction) {
    try {
      const { disputeNote } = req.body as { disputeNote?: string };
      res.json({ data: await evaluationService.acknowledge(idOf(req), disputeNote, userId(req)) });
    } catch (e) {
      next(e);
    }
  },
  async reopen(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body as { reason?: string };
      res.json({ data: await evaluationService.reopen(idOf(req), userId(req), reason) });
    } catch (e) {
      next(e);
    }
  },
  async exportXlsx(req: Request, res: Response, next: NextFunction) {
    try {
      const buf = await evaluationService.exportXlsx((req.query as { payrollPeriodId?: string }).payrollPeriodId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="danh-gia.xlsx"');
      res.send(buf);
    } catch (e) {
      next(e);
    }
  },
};
