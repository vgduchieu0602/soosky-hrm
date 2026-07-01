import type { Request, Response, NextFunction } from 'express';
import {
  companyConfigService,
  salaryPolicyService,
  performanceCriterionService,
  bankService,
} from '@features/settings/services/settings.service';

function requireUser(req: Request) {
  if (!req.user) throw new Error('IAM_002');
  return req.user;
}

export const settingsController = {
  // ---- company config ----
  async getCompany(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await companyConfigService.get() });
    } catch (err) { next(err); }
  },
  async updateCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      res.json({ data: await companyConfigService.update(req.body, user.userId) });
    } catch (err) { next(err); }
  },

  // ---- salary policy ----
  async listPolicies(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await salaryPolicyService.list() });
    } catch (err) { next(err); }
  },
  async createPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      res.status(201).json({ data: await salaryPolicyService.create(req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async updatePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await salaryPolicyService.update(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },

  // ---- performance criteria ----
  async listCriteria(req: Request, res: Response, next: NextFunction) {
    try {
      const includeArchived = req.query.all === 'true';
      res.json({ data: await performanceCriterionService.list(includeArchived) });
    } catch (err) { next(err); }
  },
  async createCriterion(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      res.status(201).json({ data: await performanceCriterionService.create(req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async updateCriterion(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await performanceCriterionService.update(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async archiveCriterion(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await performanceCriterionService.archive(id, user.userId) });
    } catch (err) { next(err); }
  },

  // ---- banks ----
  async listBanks(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await bankService.list() });
    } catch (err) { next(err); }
  },
  async createBank(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      res.status(201).json({ data: await bankService.create(req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async updateBank(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await bankService.update(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async archiveBank(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await bankService.archive(id, user.userId) });
    } catch (err) { next(err); }
  },
};
