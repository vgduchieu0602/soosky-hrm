import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { validate } from '@shared/middlewares/validate';
import { authController } from '@features/iam/controllers/auth.controller';
import { userController } from '@features/iam/controllers/user.controller';
import { roleController } from '@features/iam/controllers/role.controller';
import { permissionController } from '@features/iam/controllers/permission.controller';
import { auditController } from '@features/iam/controllers/audit.controller';
import { requireRoles } from '@shared/middlewares/require-role';
import { loginDto } from '@features/iam/dto/login.dto';
import { changePasswordDto } from '@features/iam/dto/change-password.dto';
import { setPasswordDto } from '@features/iam/dto/set-password.dto';
import { createUserDto } from '@features/iam/dto/create-user.dto';
import { createRoleDto } from '@features/iam/dto/create-role.dto';
import { updateRoleDto } from '@features/iam/dto/update-role.dto';
import { createPermissionDto } from '@features/iam/dto/create-permission.dto';

const router = Router();

// Auth routes
router.post('/auth/login', validate(loginDto, 'body'), authController.login);
router.post('/auth/refresh', authController.refresh);
router.post('/auth/logout', authenticate, authController.logout);
router.patch('/auth/change-password', authenticate, validate(changePasswordDto, 'body'), authController.changePassword);
router.get('/auth/me', authenticate, authController.me);

// Public — set/reset password via single-use email link token
router.get('/auth/set-password', authController.checkSetupToken);
router.post('/auth/set-password', validate(setPasswordDto, 'body'), authController.setPassword);

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
