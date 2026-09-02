import { Router } from 'express';
import { authenticate } from '@shared/http/authenticate';
import { validate } from '@shared/http/validate';
import { requireRoles } from '@shared/http/require-role';
import {
  userController,
  roleController,
  permissionController,
  auditController,
} from '@modules/iam/adapters/http/controllers';
import { createUserDto } from '@modules/iam/core/app/dto/create-user.dto';
import { createRoleDto } from '@modules/iam/core/app/dto/create-role.dto';
import { updateRoleDto } from '@modules/iam/core/app/dto/update-role.dto';
import { createPermissionDto } from '@modules/iam/core/app/dto/create-permission.dto';

const router = Router();

// Role/User guards
const adminOnly = requireRoles('admin');
const hrOrAdmin = requireRoles('admin', 'hr_manager');

// User routes — reads HR/Admin, mutations admin-only (account/role provisioning)
router.post('/users', authenticate, adminOnly, validate(createUserDto, 'body'), userController.create);
router.get('/users', authenticate, hrOrAdmin, userController.list);
router.get('/users/:id', authenticate, hrOrAdmin, userController.getById);
router.patch('/users/:id', authenticate, adminOnly, userController.update);
router.delete('/users/:id', authenticate, adminOnly, userController.delete);

// Role routes — mutations are admin-only
router.post('/roles', authenticate, adminOnly, validate(createRoleDto, 'body'), roleController.create);
router.get('/roles', authenticate, roleController.list);
router.get('/roles/:id', authenticate, roleController.getById);
router.patch('/roles/:id', authenticate, adminOnly, validate(updateRoleDto, 'body'), roleController.update);
router.delete('/roles/:id', authenticate, adminOnly, roleController.delete);

// Permission routes — mutations are admin-only (RBAC definitions)
router.post('/permissions', authenticate, adminOnly, validate(createPermissionDto, 'body'), permissionController.create);
router.get('/permissions', authenticate, permissionController.list);
router.get('/permissions/:id', authenticate, permissionController.getById);
router.patch('/permissions/:id', authenticate, adminOnly, permissionController.update);
router.delete('/permissions/:id', authenticate, adminOnly, permissionController.delete);

// Audit log (admin only)
router.get('/admin/audit-logs', authenticate, requireRoles('admin'), auditController.list);

export default router;
