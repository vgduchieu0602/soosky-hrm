import type { Request, Response, NextFunction } from 'express';
import { employeeDocumentService } from '@features/employee/services/employee-document.service';
import { employeeContactService } from '@features/employee/services/employee-contact.service';
import { employeeBankAccountService } from '@features/employee/services/employee-bank-account.service';
import { employeeContractService } from '@features/employee/services/employee-contract.service';
import { employeeAssetService } from '@features/employee/services/employee-asset.service';
import { employeeHistoryService } from '@features/employee/services/employee-history.service';

function requireUser(req: Request) {
  if (!req.user) throw new Error('IAM_002');
  return req.user;
}

export const documentController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeDocumentService.list(id) });
    } catch (err) { next(err); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.status(201).json({
        data: await employeeDocumentService.create(id, req.body, user.userId),
      });
    } catch (err) { next(err); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { docId } = req.params as { docId: string };
      res.json({ data: await employeeDocumentService.remove(docId, user.userId) });
    } catch (err) { next(err); }
  },
};

export const contactController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeContactService.list(id) });
    } catch (err) { next(err); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.status(201).json({
        data: await employeeContactService.create(id, req.body, user.userId),
      });
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id, contactId } = req.params as { id: string; contactId: string };
      res.json({
        data: await employeeContactService.update(id, contactId, req.body, user.userId),
      });
    } catch (err) { next(err); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { contactId } = req.params as { contactId: string };
      res.json({ data: await employeeContactService.remove(contactId, user.userId) });
    } catch (err) { next(err); }
  },
};

export const bankAccountController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeBankAccountService.list(id) });
    } catch (err) { next(err); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.status(201).json({
        data: await employeeBankAccountService.create(id, req.body, user.userId),
      });
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id, accountId } = req.params as { id: string; accountId: string };
      res.json({
        data: await employeeBankAccountService.update(id, accountId, req.body, user.userId),
      });
    } catch (err) { next(err); }
  },
};

export const contractController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeContractService.list(id) });
    } catch (err) { next(err); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.status(201).json({
        data: await employeeContractService.create(id, req.body, user.userId),
      });
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { contractId } = req.params as { contractId: string };
      res.json({
        data: await employeeContractService.update(contractId, req.body, user.userId),
      });
    } catch (err) { next(err); }
  },
};

export const assetController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeAssetService.list(id) });
    } catch (err) { next(err); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.status(201).json({
        data: await employeeAssetService.create(id, req.body, user.userId),
      });
    } catch (err) { next(err); }
  },
  async markReturned(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { assetId } = req.params as { assetId: string };
      res.json({
        data: await employeeAssetService.markReturned(assetId, req.body, user.userId),
      });
    } catch (err) { next(err); }
  },
};

export const historyController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeHistoryService.list(id) });
    } catch (err) { next(err); }
  },
};
