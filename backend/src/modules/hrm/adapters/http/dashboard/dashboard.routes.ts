import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { requireRoles } from '@shared/middlewares/require-role';
import { dashboardController } from '@modules/hrm/adapters/http/dashboard/controllers';

const router = Router();
const hrOrAdmin = requireRoles('admin', 'hr_manager');

router.get('/admin/dashboard', authenticate, hrOrAdmin, dashboardController.overview);

export default router;
