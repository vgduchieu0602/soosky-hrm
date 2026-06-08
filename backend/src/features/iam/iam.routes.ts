import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { validate } from '@shared/middlewares/validate';
import { authController } from '@features/iam/controllers/auth.controller';
import { userController } from '@features/iam/controllers/user.controller';
import { roleController } from '@features/iam/controllers/role.controller';
import { permissionController } from '@features/iam/controllers/permission.controller';
import { loginDto } from '@features/iam/dto/login.dto';
import { changePasswordDto } from '@features/iam/dto/change-password.dto';
import { createUserDto } from '@features/iam/dto/create-user.dto';
import { createRoleDto } from '@features/iam/dto/create-role.dto';
import { createPermissionDto } from '@features/iam/dto/create-permission.dto';

const router = Router();

// Auth routes
router.post('/auth/login', validate(loginDto, 'body'), authController.login);
router.post('/auth/refresh', authController.refresh);
router.post('/auth/logout', authenticate, authController.logout);
router.patch('/auth/change-password', authenticate, validate(changePasswordDto, 'body'), authController.changePassword);
router.get('/auth/me', authenticate, authController.me);

// User routes
router.post('/users', authenticate, validate(createUserDto, 'body'), userController.create);
router.get('/users', authenticate, userController.list);
router.get('/users/:id', authenticate, userController.getById);
router.patch('/users/:id', authenticate, userController.update);
router.delete('/users/:id', authenticate, userController.delete);

// Role routes
router.post('/roles', authenticate, validate(createRoleDto, 'body'), roleController.create);
router.get('/roles', authenticate, roleController.list);
router.get('/roles/:id', authenticate, roleController.getById);
router.patch('/roles/:id', authenticate, roleController.update);
router.delete('/roles/:id', authenticate, roleController.delete);

// Permission routes
router.post('/permissions', authenticate, validate(createPermissionDto, 'body'), permissionController.create);
router.get('/permissions', authenticate, permissionController.list);
router.get('/permissions/:id', authenticate, permissionController.getById);
router.patch('/permissions/:id', authenticate, permissionController.update);
router.delete('/permissions/:id', authenticate, permissionController.delete);

export default router;
