import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { requireRoles } from '@shared/middlewares/require-role';
import { validate } from '@shared/middlewares/validate';
import { settingsController } from '@features/settings/controllers/settings.controller';
import {
  updateCompanyConfigDto,
  createSalaryPolicyDto,
  updateSalaryPolicyDto,
  createCriterionDto,
  updateCriterionDto,
} from '@features/settings/dto/settings.dto';

const router = Router();
const adminOnly = requireRoles('admin');
const hrOrAdmin = requireRoles('admin', 'hr_manager');

// ---- Company / general config ----
router.get('/settings/company', authenticate, settingsController.getCompany);
router.patch(
  '/admin/settings/company',
  authenticate,
  adminOnly,
  validate(updateCompanyConfigDto, 'body'),
  settingsController.updateCompany,
);

// ---- Salary policy config ----
router.get('/settings/salary-policies', authenticate, hrOrAdmin, settingsController.listPolicies);
router.post(
  '/admin/settings/salary-policies',
  authenticate,
  adminOnly,
  validate(createSalaryPolicyDto, 'body'),
  settingsController.createPolicy,
);
router.patch(
  '/admin/settings/salary-policies/:id',
  authenticate,
  adminOnly,
  validate(updateSalaryPolicyDto, 'body'),
  settingsController.updatePolicy,
);

// ---- Performance criteria ----
router.get('/settings/performance-criteria', authenticate, settingsController.listCriteria);
router.post(
  '/admin/settings/performance-criteria',
  authenticate,
  hrOrAdmin,
  validate(createCriterionDto, 'body'),
  settingsController.createCriterion,
);
router.patch(
  '/admin/settings/performance-criteria/:id',
  authenticate,
  hrOrAdmin,
  validate(updateCriterionDto, 'body'),
  settingsController.updateCriterion,
);
router.delete(
  '/admin/settings/performance-criteria/:id',
  authenticate,
  hrOrAdmin,
  settingsController.archiveCriterion,
);

export default router;
