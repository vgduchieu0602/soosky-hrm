import type { Request, Response, NextFunction } from 'express';
import { employeeService } from '@features/employee/services/employee.service';
import { accountProvisioningService } from '@features/employee/services/account-provisioning.service';
import { employeeAccountService } from '@features/employee/services/employee-account.service';

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
      const { items, meta } = await employeeService.list(
        req.query as Record<string, string | undefined>,
      );
      res.json({ data: items, meta });
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
      const csv = await employeeService.exportCsv(
        req.query as Record<string, string | undefined>,
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
      res.send(csv);
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
