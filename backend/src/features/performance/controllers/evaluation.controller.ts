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
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await evaluationService.get(idOf(req)) });
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
      res.json({ data: await evaluationService.reopen(idOf(req), userId(req)) });
    } catch (e) {
      next(e);
    }
  },
};
