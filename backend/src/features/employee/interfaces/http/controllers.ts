import type { Request, Response, NextFunction } from 'express';
import {
  employeeService,
  accountProvisioningService,
  employeeAccountService,
  employeeReminderService,
  employeeImportService,
  employeeCompletenessService,
  employeeDocumentService,
  employeeContactService,
  employeeBankAccountService,
  employeeContractService,
  employeeAssetService,
  employeeHistoryService,
} from '@features/employee/container';
import type { BulkTerminateEmployeesDto } from '@features/employee/dto/sub-resource.dto';

function requireUser(req: Request) {
  if (!req.user) throw new Error('IAM_002');
  return req.user;
}

export const employeeController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const employee = await employeeService.create(req.body, user.userId);
      res.status(201).json({
        data: employee,
        message: 'Employee created. Run grant-login to provision account.',
      });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { items, meta } = await employeeService.list(req.query as Record<string, string | undefined>);
      res.json({ data: items, meta });
    } catch (err) {
      next(err);
    }
  },

  async importEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { rows } = req.body as { rows: Parameters<typeof employeeImportService.importEmployees>[0] };
      res.json({ data: await employeeImportService.importEmployees(rows, user.userId) });
    } catch (err) {
      next(err);
    }
  },

  async reminders(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const raw = Number((req.query as { withinDays?: string }).withinDays);
      const withinDays = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 365) : 30;
      res.json({ data: await employeeReminderService.expiring(withinDays) });
    } catch (err) {
      next(err);
    }
  },

  async runReminders(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await employeeReminderService.runContractReminders() });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      const employee = await employeeService.findById(id);
      res.json({ data: employee });
    } catch (err) {
      next(err);
    }
  },

  async completeness(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeCompletenessService.forEmployee(id) });
    } catch (err) {
      next(err);
    }
  },

  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const employee = await employeeService.findMine(user.userId);
      res.json({ data: employee });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      const updated = await employeeService.update(id, req.body, user.userId);
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },

  async grantLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      const result = await accountProvisioningService.grantLogin(id, req.body, user.userId);
      res.json({ data: result, message: 'Login credentials sent to personal email' });
    } catch (err) {
      next(err);
    }
  },

  async terminate(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      const result = await employeeService.terminate(id, req.body, user.userId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },

  async terminateMany(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { employeeIds, ...rest } = req.body as BulkTerminateEmployeesDto;
      const result = await employeeService.terminateMany(employeeIds, rest, user.userId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      const result = await employeeService.remove(id, user.userId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      const employee = await employeeService.findById(id);
      res.json({ data: employee.profile });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      const profile = await employeeService.updateProfile(id, req.body, user.userId);
      res.json({ data: profile });
    } catch (err) {
      next(err);
    }
  },

  async stats(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const stats = await employeeService.stats();
      res.json({ data: stats });
    } catch (err) {
      next(err);
    }
  },

  async exportCsv(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const buf = await employeeService.exportXlsx(req.query as Record<string, string | undefined>);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="employees.xlsx"');
      res.send(buf);
    } catch (err) {
      next(err);
    }
  },

  // ---------- Account (linked user) ----------
  async getAccount(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeAccountService.getAccount(id) });
    } catch (err) {
      next(err);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      const result = await employeeAccountService.resetPassword(id, user.userId);
      res.json({ data: result, message: 'Temporary password sent to user email' });
    } catch (err) {
      next(err);
    }
  },

  async resendInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      const result = await employeeAccountService.resendInvite(id, user.userId);
      res.json({ data: result, message: 'Invite re-sent to user email' });
    } catch (err) {
      next(err);
    }
  },

  async updateAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      const result = await employeeAccountService.update(id, req.body, user.userId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
};

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
      res.status(201).json({ data: await employeeDocumentService.create(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { docId } = req.params as { docId: string };
      res.json({ data: await employeeDocumentService.update(docId, req.body, user.userId) });
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
      res.status(201).json({ data: await employeeContactService.create(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id, contactId } = req.params as { id: string; contactId: string };
      res.json({ data: await employeeContactService.update(id, contactId, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id, contactId } = req.params as { id: string; contactId: string };
      res.json({ data: await employeeContactService.remove(id, contactId, user.userId) });
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
      res.status(201).json({ data: await employeeBankAccountService.create(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id, accountId } = req.params as { id: string; accountId: string };
      res.json({ data: await employeeBankAccountService.update(id, accountId, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id, accountId } = req.params as { id: string; accountId: string };
      res.json({ data: await employeeBankAccountService.remove(id, accountId, user.userId) });
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
      res.status(201).json({ data: await employeeContractService.create(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { contractId } = req.params as { contractId: string };
      res.json({ data: await employeeContractService.update(contractId, req.body, user.userId) });
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
      res.status(201).json({ data: await employeeAssetService.create(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async markReturned(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { assetId } = req.params as { assetId: string };
      res.json({ data: await employeeAssetService.markReturned(assetId, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { assetId } = req.params as { assetId: string };
      res.json({ data: await employeeAssetService.update(assetId, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { assetId } = req.params as { assetId: string };
      res.json({ data: await employeeAssetService.remove(assetId, user.userId) });
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
