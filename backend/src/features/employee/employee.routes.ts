import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { requireRoles } from '@shared/middlewares/require-role';
import { validate } from '@shared/middlewares/validate';

import { employeeController } from '@features/employee/controllers/employee.controller';
import {
  documentController,
  contactController,
  bankAccountController,
  contractController,
  assetController,
  historyController,
} from '@features/employee/controllers/sub-resource.controller';

import { createEmployeeDto } from '@features/employee/dto/create-employee.dto';
import { updateEmployeeDto } from '@features/employee/dto/update-employee.dto';
import { updateProfileDto } from '@features/employee/dto/update-profile.dto';
import { grantLoginDto } from '@features/employee/dto/grant-login.dto';
import {
  createDocumentDto,
  createContactDto,
  updateContactDto,
  createBankAccountDto,
  updateBankAccountDto,
  createContractDto,
  updateContractDto,
  createAssetDto,
  returnAssetDto,
  terminateEmployeeDto,
} from '@features/employee/dto/sub-resource.dto';

const router = Router();

const hrOrAdmin = requireRoles('admin', 'hr_manager');

// ---------- Read endpoints (authenticated user) ----------
router.get('/employees', authenticate, employeeController.list);
router.get('/employees/stats', authenticate, employeeController.stats);
router.get('/employees/me', authenticate, employeeController.getMe);
router.get('/employees/:id', authenticate, employeeController.getById);
router.get('/employees/:id/profile', authenticate, employeeController.getProfile);
router.patch(
  '/employees/:id/profile',
  authenticate,
  validate(updateProfileDto, 'body'),
  employeeController.updateProfile,
);

// Sub-resources — read accessible to any authenticated user (HR & self)
router.get('/employees/:id/documents', authenticate, documentController.list);
router.get('/employees/:id/contacts', authenticate, contactController.list);
router.get('/employees/:id/bank-accounts', authenticate, bankAccountController.list);
router.get('/employees/:id/contracts', authenticate, contractController.list);
router.get('/employees/:id/assets', authenticate, assetController.list);
router.get('/employees/:id/history', authenticate, historyController.list);

// Sub-resource writes accessible to self or HR (no role gate here — service can refine)
router.post(
  '/employees/:id/documents',
  authenticate,
  validate(createDocumentDto, 'body'),
  documentController.create,
);
router.post(
  '/employees/:id/contacts',
  authenticate,
  validate(createContactDto, 'body'),
  contactController.create,
);
router.patch(
  '/employees/:id/contacts/:contactId',
  authenticate,
  validate(updateContactDto, 'body'),
  contactController.update,
);
router.delete('/employees/:id/contacts/:contactId', authenticate, contactController.remove);
router.post(
  '/employees/:id/bank-accounts',
  authenticate,
  validate(createBankAccountDto, 'body'),
  bankAccountController.create,
);
router.patch(
  '/employees/:id/bank-accounts/:accountId',
  authenticate,
  validate(updateBankAccountDto, 'body'),
  bankAccountController.update,
);

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
router.post(
  '/admin/employees/:id/terminate',
  authenticate,
  hrOrAdmin,
  validate(terminateEmployeeDto, 'body'),
  employeeController.terminate,
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

export default router;
