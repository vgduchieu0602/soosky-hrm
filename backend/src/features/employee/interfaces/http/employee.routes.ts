import { Router, json } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { requireRoles } from '@shared/middlewares/require-role';
import { selfOrHr } from '@modules/hrm/adapters/http/middlewares/self-or-hr';
import { validate } from '@shared/middlewares/validate';

import {
  employeeController,
  documentController,
  contactController,
  bankAccountController,
  contractController,
  assetController,
  historyController,
  lifecycleController,
} from '@features/employee/interfaces/http/controllers';

import {
  transferDepartmentDto,
  changePositionDto,
  changeManagerDto,
  completeProbationDto,
  extendProbationDto,
  changeSalaryDto,
  endEmploymentDto,
  rehireDto,
} from '@features/employee/dto/lifecycle.dto';

import { createEmployeeDto } from '@features/employee/dto/create-employee.dto';
import { importPreviewDto, importCommitDto } from '@features/employee/dto/import-employees.dto';
import { updateEmployeeDto } from '@features/employee/dto/update-employee.dto';
import { updateProfileDto } from '@features/employee/dto/update-profile.dto';
import { grantLoginDto } from '@features/employee/dto/grant-login.dto';
import { updateAccountDto } from '@features/employee/dto/account.dto';
import {
  createDocumentDto,
  updateDocumentDto,
  createContactDto,
  updateContactDto,
  createBankAccountDto,
  updateBankAccountDto,
  createContractDto,
  updateContractDto,
  createAssetDto,
  updateAssetDto,
  returnAssetDto,
  terminateEmployeeDto,
  bulkTerminateEmployeesDto,
} from '@features/employee/dto/sub-resource.dto';

const router = Router();

const hrOrAdmin = requireRoles('admin', 'hr_manager');

/** Trần body cho hai route nhập CSV (~5.000 dòng vẫn lọt). */
const IMPORT_BODY_LIMIT = '8mb';

// ---------- Read endpoints (authenticated user) ----------
router.get('/employees', authenticate, employeeController.list);
router.get('/employees/stats', authenticate, employeeController.stats);
router.get('/employees/reminders', authenticate, hrOrAdmin, employeeController.reminders);
router.post('/admin/employees/reminders/run', authenticate, hrOrAdmin, employeeController.runReminders);
// Bản xuất chứa PII đầy đủ (ngày sinh, địa chỉ, mã số thuế, số BHXH) nên chỉ
// HR/Admin được gọi — trước đây mọi tài khoản đăng nhập đều tải được.
router.get('/employees/export', authenticate, hrOrAdmin, employeeController.exportCsv);
router.get('/employees/import/template', authenticate, hrOrAdmin, employeeController.importTemplate);
router.get('/employees/import/schema', authenticate, hrOrAdmin, employeeController.importSchema);
router.get('/employees/me', authenticate, employeeController.getMe);
router.get('/employees/:id', authenticate, selfOrHr(), employeeController.getById);
router.get('/employees/:id/account', authenticate, selfOrHr(), employeeController.getAccount);
router.get('/employees/:id/completeness', authenticate, selfOrHr(), employeeController.completeness);
router.get('/employees/:id/profile', authenticate, selfOrHr(), employeeController.getProfile);
router.patch(
  '/employees/:id/profile',
  authenticate,
  selfOrHr(),
  validate(updateProfileDto, 'body'),
  employeeController.updateProfile,
);

// Sub-resources — read accessible to the owner employee or HR/Admin
router.get('/employees/:id/documents', authenticate, selfOrHr(), documentController.list);
router.get('/employees/:id/contacts', authenticate, selfOrHr(), contactController.list);
router.get('/employees/:id/bank-accounts', authenticate, selfOrHr(), bankAccountController.list);
router.get('/employees/:id/contracts', authenticate, selfOrHr(), contractController.list);
router.get('/employees/:id/assets', authenticate, selfOrHr(), assetController.list);
router.get('/employees/:id/history', authenticate, selfOrHr(), historyController.list);
router.get('/employees/:id/lifecycle', authenticate, selfOrHr(), lifecycleController.timeline);

// Sub-resource writes accessible to the owner employee or HR/Admin
router.post(
  '/employees/:id/documents',
  authenticate,
  selfOrHr(),
  validate(createDocumentDto, 'body'),
  documentController.create,
);
router.post(
  '/employees/:id/contacts',
  authenticate,
  selfOrHr(),
  validate(createContactDto, 'body'),
  contactController.create,
);
router.patch(
  '/employees/:id/contacts/:contactId',
  authenticate,
  selfOrHr(),
  validate(updateContactDto, 'body'),
  contactController.update,
);
router.delete('/employees/:id/contacts/:contactId', authenticate, selfOrHr(), contactController.remove);
router.post(
  '/employees/:id/bank-accounts',
  authenticate,
  selfOrHr(),
  validate(createBankAccountDto, 'body'),
  bankAccountController.create,
);
router.patch(
  '/employees/:id/bank-accounts/:accountId',
  authenticate,
  selfOrHr(),
  validate(updateBankAccountDto, 'body'),
  bankAccountController.update,
);
router.delete('/employees/:id/bank-accounts/:accountId', authenticate, selfOrHr(), bankAccountController.remove);

// ---------- Admin / HR-only mutations ----------
router.post(
  '/admin/employees',
  authenticate,
  hrOrAdmin,
  validate(createEmployeeDto, 'body'),
  employeeController.create,
);
router.patch(
  '/admin/employees/:id',
  authenticate,
  hrOrAdmin,
  validate(updateEmployeeDto, 'body'),
  employeeController.update,
);
router.post(
  '/admin/employees/:id/grant-login',
  authenticate,
  hrOrAdmin,
  validate(grantLoginDto, 'body'),
  employeeController.grantLogin,
);
// Nhập CSV: xem trước (không ghi) → HR sửa → ghi thật (kèm importId + checksum).
// Hai route này nhận cả tệp vài nghìn dòng nên cần trần body riêng, thay vì nới
// giới hạn 1MB chung cho toàn bộ API.
const importBody = json({ limit: IMPORT_BODY_LIMIT });

router.post(
  '/admin/employees/import/preview',
  authenticate,
  hrOrAdmin,
  importBody,
  validate(importPreviewDto, 'body'),
  employeeController.previewImport,
);
router.post(
  '/admin/employees/import/commit',
  authenticate,
  hrOrAdmin,
  importBody,
  validate(importCommitDto, 'body'),
  employeeController.commitImport,
);

// ---------- Vòng đời nhân viên (HR/Admin) ----------
router.post(
  '/admin/employees/:id/transfer',
  authenticate,
  hrOrAdmin,
  validate(transferDepartmentDto, 'body'),
  lifecycleController.transferDepartment,
);
router.post(
  '/admin/employees/:id/change-position',
  authenticate,
  hrOrAdmin,
  validate(changePositionDto, 'body'),
  lifecycleController.changePosition,
);
router.post(
  '/admin/employees/:id/change-manager',
  authenticate,
  hrOrAdmin,
  validate(changeManagerDto, 'body'),
  lifecycleController.changeManager,
);
router.post(
  '/admin/employees/:id/probation/complete',
  authenticate,
  hrOrAdmin,
  validate(completeProbationDto, 'body'),
  lifecycleController.completeProbation,
);
router.post(
  '/admin/employees/:id/probation/extend',
  authenticate,
  hrOrAdmin,
  validate(extendProbationDto, 'body'),
  lifecycleController.extendProbation,
);
router.post(
  '/admin/employees/:id/change-salary',
  authenticate,
  hrOrAdmin,
  validate(changeSalaryDto, 'body'),
  lifecycleController.changeSalary,
);
router.post(
  '/admin/employees/:id/end-employment',
  authenticate,
  hrOrAdmin,
  validate(endEmploymentDto, 'body'),
  lifecycleController.endEmployment,
);
router.post(
  '/admin/employees/:id/rehire',
  authenticate,
  hrOrAdmin,
  validate(rehireDto, 'body'),
  lifecycleController.rehire,
);
router.post(
  '/admin/employees/bulk/terminate',
  authenticate,
  hrOrAdmin,
  validate(bulkTerminateEmployeesDto, 'body'),
  employeeController.terminateMany,
);
router.post(
  '/admin/employees/:id/terminate',
  authenticate,
  hrOrAdmin,
  validate(terminateEmployeeDto, 'body'),
  employeeController.terminate,
);
// Hard delete (cascade) — admin & HR only
router.delete('/admin/employees/:id', authenticate, hrOrAdmin, employeeController.remove);
router.post(
  '/admin/employees/:id/reset-password',
  authenticate,
  hrOrAdmin,
  employeeController.resetPassword,
);
router.post(
  '/admin/employees/:id/resend-invite',
  authenticate,
  hrOrAdmin,
  employeeController.resendInvite,
);
router.patch(
  '/admin/employees/:id/account',
  authenticate,
  hrOrAdmin,
  validate(updateAccountDto, 'body'),
  employeeController.updateAccount,
);
router.patch(
  '/admin/employees/:id/documents/:docId',
  authenticate,
  hrOrAdmin,
  validate(updateDocumentDto, 'body'),
  documentController.update,
);
router.delete(
  '/admin/employees/:id/documents/:docId',
  authenticate,
  hrOrAdmin,
  documentController.remove,
);
router.post(
  '/admin/employees/:id/contracts',
  authenticate,
  hrOrAdmin,
  validate(createContractDto, 'body'),
  contractController.create,
);
router.patch(
  '/admin/employees/:id/contracts/:contractId',
  authenticate,
  hrOrAdmin,
  validate(updateContractDto, 'body'),
  contractController.update,
);
router.post(
  '/admin/employees/:id/assets',
  authenticate,
  hrOrAdmin,
  validate(createAssetDto, 'body'),
  assetController.create,
);
router.patch(
  '/admin/employees/:id/assets/:assetId/return',
  authenticate,
  hrOrAdmin,
  validate(returnAssetDto, 'body'),
  assetController.markReturned,
);
router.patch(
  '/admin/employees/:id/assets/:assetId',
  authenticate,
  hrOrAdmin,
  validate(updateAssetDto, 'body'),
  assetController.update,
);
router.delete(
  '/admin/employees/:id/assets/:assetId',
  authenticate,
  hrOrAdmin,
  assetController.remove,
);

export default router;
