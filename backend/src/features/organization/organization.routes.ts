import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { requireRoles } from '@shared/middlewares/require-role';
import { validate } from '@shared/middlewares/validate';

import { departmentController } from '@features/organization/controllers/department.controller';
import { positionController } from '@features/organization/controllers/position.controller';

import {
  createDepartmentDto,
  updateDepartmentDto,
} from '@features/organization/dto/department.dto';
import {
  createPositionDto,
  updatePositionDto,
} from '@features/organization/dto/position.dto';

const router = Router();

const hrOrAdmin = requireRoles('admin', 'hr_manager');

// Departments — public read for authenticated users
router.get('/departments', authenticate, departmentController.list);
router.get('/departments/:id', authenticate, departmentController.getById);

router.post(
  '/admin/departments',
  authenticate,
  hrOrAdmin,
  validate(createDepartmentDto, 'body'),
  departmentController.create,
);
router.patch(
  '/admin/departments/:id',
  authenticate,
  hrOrAdmin,
  validate(updateDepartmentDto, 'body'),
  departmentController.update,
);
router.delete('/admin/departments/:id', authenticate, hrOrAdmin, departmentController.archive);

// Positions
router.get('/positions', authenticate, positionController.list);
router.get('/positions/:id', authenticate, positionController.getById);

router.post(
  '/admin/positions',
  authenticate,
  hrOrAdmin,
  validate(createPositionDto, 'body'),
  positionController.create,
);
router.patch(
  '/admin/positions/:id',
  authenticate,
  hrOrAdmin,
  validate(updatePositionDto, 'body'),
  positionController.update,
);
router.delete('/admin/positions/:id', authenticate, hrOrAdmin, positionController.remove);

export default router;
