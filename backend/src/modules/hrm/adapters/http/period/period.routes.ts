import { Router } from 'express';
import { authenticate } from '@shared/http/authenticate';
import { requireRoles } from '@shared/http/require-role';
import { validate } from '@shared/http/validate';
import { createPeriodController } from '@modules/hrm/adapters/http/period/period.controller';
import { createPeriodDto, updatePeriodDto } from '@modules/hrm/core/period/dto/period.dto';
import type { PeriodUseCases } from '@modules/hrm/core/period/app/period.usecases';

export function createPeriodRouter(useCases: PeriodUseCases): Router {
  const router = Router();
  const hrOrAdmin = requireRoles('admin', 'hr_manager');
  const adminOnly = requireRoles('admin');
  const controller = createPeriodController(useCases);

  // ---- HR periods (also consumed by attendance / performance locks) ----
  router.get('/payroll/periods', authenticate, hrOrAdmin, controller.list);
  router.get('/payroll/periods/:id', authenticate, hrOrAdmin, controller.get);
  router.post('/payroll/periods', authenticate, hrOrAdmin, validate(createPeriodDto, 'body'), controller.create);
  router.patch('/payroll/periods/:id', authenticate, hrOrAdmin, validate(updatePeriodDto, 'body'), controller.update);
  router.post('/payroll/periods/:id/close', authenticate, hrOrAdmin, controller.close);
  router.post('/payroll/periods/:id/reopen', authenticate, adminOnly, controller.reopen);
  router.delete('/payroll/periods/:id', authenticate, hrOrAdmin, controller.remove);
  router.get('/payroll/periods/:id/attendance-readiness', authenticate, hrOrAdmin, controller.attendanceReadiness);
  router.post('/payroll/periods/:id/lock-attendance', authenticate, hrOrAdmin, controller.lockAttendance);
  router.post('/payroll/periods/:id/unlock-attendance', authenticate, hrOrAdmin, controller.unlockAttendance);
  router.get('/payroll/periods/:id/performance-readiness', authenticate, hrOrAdmin, controller.performanceReadiness);
  router.post('/payroll/periods/:id/lock-performance', authenticate, hrOrAdmin, controller.lockPerformance);
  router.post('/payroll/periods/:id/unlock-performance', authenticate, hrOrAdmin, controller.unlockPerformance);

  return router;
}
