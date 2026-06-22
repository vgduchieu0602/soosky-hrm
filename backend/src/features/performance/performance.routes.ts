import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { requireRoles } from '@shared/middlewares/require-role';
import { validate } from '@shared/middlewares/validate';
import { evaluationController } from '@features/performance/controllers/evaluation.controller';
import { directEvaluateDto, acknowledgeDto } from '@features/performance/dto/evaluation.dto';

const router = Router();
const hrOrAdmin = requireRoles('admin', 'hr_manager');

// ---- Self-service (employee): chỉ xem + xác nhận ----
router.get('/performance/evaluations/me', authenticate, evaluationController.mine);
router.post('/performance/evaluations/:id/acknowledge', authenticate, validate(acknowledgeDto, 'body'), evaluationController.acknowledge);

// ---- HR / Admin: chấm trực tiếp ----
router.get('/performance/evaluations', authenticate, hrOrAdmin, evaluationController.list);
router.get('/performance/evaluations/employee/:employeeId', authenticate, hrOrAdmin, evaluationController.byEmployee);
router.get('/performance/evaluations/:id', authenticate, evaluationController.get);
router.post('/performance/evaluations', authenticate, hrOrAdmin, validate(directEvaluateDto, 'body'), evaluationController.evaluate);
router.post('/performance/evaluations/:id/reopen', authenticate, hrOrAdmin, evaluationController.reopen);

export default router;
