import { Router } from 'express';
import { authenticate } from '@shared/http/authenticate';
import { validate } from '@shared/http/validate';
import { authController } from '@modules/auth/adapters/http/controllers';
import { loginDto } from '@modules/auth/core/app/dto/login.dto';
import { changePasswordDto } from '@modules/auth/core/app/dto/change-password.dto';
import { setPasswordDto } from '@modules/auth/core/app/dto/set-password.dto';

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

export default router;
