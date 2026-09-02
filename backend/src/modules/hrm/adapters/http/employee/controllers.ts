import type { Request, Response, NextFunction } from 'express';
import { auditService } from '@features/iam';
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
  employeeLifecycleService,
} from '@modules/hrm/adapters/container/employee';
import type { BulkTerminateEmployeesDto } from '@modules/hrm/core/employee/dto/sub-resource.dto';
import type { ImportPreviewDto, ImportCommitDto } from '@modules/hrm/core/employee/dto/import-employees.dto';
import { csvSchemaForClient } from '@modules/hrm/core/employee/domain/employee-csv-schema';

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

  /** Bước xem trước: kiểm tra + tra tham chiếu, KHÔNG ghi gì vào cơ sở dữ liệu. */
  async previewImport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const body = req.body as ImportPreviewDto;
      res.json({ data: await employeeImportService.preview(body, user.userId) });
    } catch (err) {
      next(err);
    }
  },

  async commitImport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const body = req.body as ImportCommitDto;
      res.json({ data: await employeeImportService.commit(body, user.userId) });
    } catch (err) {
      next(err);
    }
  },

  /** Đặc tả cột CSV — giao diện dựng bảng hướng dẫn từ đây, không tự chép lại. */
  async importSchema(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      res.json({ data: csvSchemaForClient() });
    } catch (err) {
      next(err);
    }
  },

  /** Tệp mẫu CSV cho HR tải về điền — chỉ dòng header. */
  async importTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const csv = employeeService.importTemplate();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="employees-import-template.csv"');
      res.send(csv);
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

  /**
   * Xuất danh sách nhân viên. `?format=csv` (mặc định) trả CSV đủ trường để nhập
   * lại; `?format=xlsx` giữ bản báo cáo cũ.
   */
  async exportCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const query = req.query as Record<string, string | undefined>;
      // Cột nhạy cảm (ngân hàng, lương, mã số thuế, BHXH, ngày sinh, địa chỉ) chỉ
      // dành cho HR/Admin; vai trò khác vẫn nhận đủ cột nhưng ô để trống.
      const includeSensitive = user.roles.some((r) => r === 'admin' || r === 'hr_manager');

      if (query.format === 'xlsx') {
        const buf = await employeeService.exportXlsx(query);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="employees.xlsx"');
        res.send(buf);
      } else {
        const csv = await employeeService.exportCsv(query, includeSensitive);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
        res.send(csv);
      }

      await auditService.record({
        userId: user.userId,
        resource: 'employee',
        action: 'export',
        changes: {
          format: query.format === 'xlsx' ? 'xlsx' : 'csv',
          includeSensitive,
          filters: {
            departmentId: query.departmentId ?? null,
            status: query.status ?? null,
            employeeType: query.employeeType ?? null,
            q: query.q ?? null,
          },
        },
      });
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

/**
 * Vòng đời nhân viên. Mọi handler đều nhận `:id` trên URL và lý do trong body —
 * không có thao tác nào ghi lịch sử mà thiếu người thực hiện.
 */
export const lifecycleController = {
  async timeline(req: Request, res: Response, next: NextFunction) {
    try {
      requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeLifecycleService.timeline(id) });
    } catch (err) { next(err); }
  },
  async transferDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeLifecycleService.transferDepartment(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async changePosition(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeLifecycleService.changePosition(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async changeManager(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeLifecycleService.changeManager(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async completeProbation(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeLifecycleService.completeProbation(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async extendProbation(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeLifecycleService.extendProbation(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async changeSalary(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.status(201).json({ data: await employeeLifecycleService.changeSalary(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async endEmployment(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeLifecycleService.endEmployment(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
  async rehire(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const { id } = req.params as { id: string };
      res.json({ data: await employeeLifecycleService.rehire(id, req.body, user.userId) });
    } catch (err) { next(err); }
  },
};
