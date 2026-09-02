/**
 * Composition root — the only place that knows about concrete adapters.
 * Wires infrastructure implementations into the application use-cases.
 */
import { MongooseEvaluationRepository } from '@modules/hrm/adapters/persistence/mongoose/performance/evaluation.repository';
import { MongooseCriterionRepository } from '@modules/hrm/adapters/persistence/mongoose/performance/criterion.repository';
import {
  MongooseEmployeeGateway,
  MongooseCriterionGateway,
  MongoosePayrollLockGateway,
} from '@modules/hrm/adapters/persistence/mongoose/performance/gateways';
import { periodGateway } from '@modules/hrm/adapters/container/period';
import {
  SystemClock,
  AuditServiceAdapter,
  EventBusAdapter,
} from '@modules/hrm/adapters/services/performance.services';
import { EvaluationUseCases } from '@modules/hrm/core/performance/app/evaluation.usecases';
import { CriterionUseCases } from '@modules/hrm/core/performance/app/criterion.usecases';

// --- infrastructure ---
const evaluationRepo = new MongooseEvaluationRepository();
const criterionRepo = new MongooseCriterionRepository();
const employeeGw = new MongooseEmployeeGateway();
const criterionGw = new MongooseCriterionGateway();
const payrollLockGw = new MongoosePayrollLockGateway(periodGateway);
const clock = new SystemClock();
const audit = new AuditServiceAdapter();
const events = new EventBusAdapter();

// --- application ---
export const evaluationUseCases = new EvaluationUseCases(
  evaluationRepo, employeeGw, criterionGw, payrollLockGw, audit, events, clock,
);
export const criterionUseCases = new CriterionUseCases(criterionRepo);
