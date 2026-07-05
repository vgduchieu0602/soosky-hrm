import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { requireRoles } from '@shared/middlewares/require-role';
import { validate } from '@shared/middlewares/validate';

import {
  departmentController,
  positionController,
} from '@features/organization/interfaces/http/controllers';

import {
  createDepartmentDto,
  updateDepartmentDto,
  assignHeadDto,
  moveDepartmentDto,
  transferEmployeesDto,
  mergeDepartmentDto,
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
router.get('/departments/:id/history', authenticate, departmentController.history);

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
router.patch(
  '/admin/departments/:id/head',
  authenticate,
  hrOrAdmin,
  validate(assignHeadDto, 'body'),
  departmentController.assignHead,
);
router.patch(
  '/admin/departments/:id/move',
  authenticate,
  hrOrAdmin,
  validate(moveDepartmentDto, 'body'),
  departmentController.move,
);
router.post(
  '/admin/departments/:id/transfer-employees',
  authenticate,
  hrOrAdmin,
  validate(transferEmployeesDto, 'body'),
  departmentController.transferEmployees,
);
router.post(
  '/admin/departments/:id/merge',
  authenticate,
  hrOrAdmin,
  validate(mergeDepartmentDto, 'body'),
  departmentController.merge,
);
router.delete('/admin/departments/:id', authenticate, hrOrAdmin, departmentController.remove);

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
router.delete('/admin/positions/:id', authenticate, hrOrAdmin, positionController.archive);

export default router;
