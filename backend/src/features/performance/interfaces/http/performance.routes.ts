import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { requireRoles } from '@shared/middlewares/require-role';
import { validate } from '@shared/middlewares/validate';
import { criterionController, evaluationController } from '@features/performance/interfaces/http/controllers';
import { directEvaluateDto, acknowledgeDto, reopenDto } from '@features/performance/dto/evaluation.dto';
import { createCriterionDto, updateCriterionDto } from '@features/performance/dto/criterion.dto';

const router = Router();
const hrOrAdmin = requireRoles('admin', 'hr_manager');

// ---- Criteria management: one model, filter by performance/goal group ----
router.get('/performance/criteria', authenticate, hrOrAdmin, criterionController.list);
router.post('/performance/criteria', authenticate, hrOrAdmin, validate(createCriterionDto, 'body'), criterionController.create);
router.patch('/performance/criteria/:id', authenticate, hrOrAdmin, validate(updateCriterionDto, 'body'), criterionController.update);
router.post('/performance/criteria/:id/deactivate', authenticate, hrOrAdmin, criterionController.deactivate);

// ---- Self-service (employee): chỉ xem + xác nhận ----
router.get('/performance/evaluations/me', authenticate, evaluationController.mine);
router.post('/performance/evaluations/:id/acknowledge', authenticate, validate(acknowledgeDto, 'body'), evaluationController.acknowledge);

// ---- HR / Admin: chấm trực tiếp ----
router.get('/performance/evaluations', authenticate, hrOrAdmin, evaluationController.list);
router.get('/performance/evaluations/export', authenticate, hrOrAdmin, evaluationController.exportXlsx);
router.get('/performance/evaluations/employee/:employeeId', authenticate, hrOrAdmin, evaluationController.byEmployee);
router.get('/performance/evaluations/:id', authenticate, evaluationController.get);
router.post('/performance/evaluations', authenticate, hrOrAdmin, validate(directEvaluateDto, 'body'), evaluationController.evaluate);
router.post('/performance/evaluations/:id/reopen', authenticate, hrOrAdmin, validate(reopenDto, 'body'), evaluationController.reopen);

export default router;
