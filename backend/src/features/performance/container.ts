/**
 * Composition root — the only place that knows about concrete adapters.
 * Wires infrastructure implementations into the application use-cases.
 */
import { MongooseEvaluationRepository } from '@features/performance/infrastructure/evaluation.repository.mongoose';
import {
  MongooseEmployeeGateway,
  MongooseCriterionGateway,
  MongoosePayrollLockGateway,
} from '@features/performance/infrastructure/gateways.mongoose';
import {
  SystemClock,
  AuditServiceAdapter,
  EventBusAdapter,
} from '@features/performance/infrastructure/services';
import { EvaluationUseCases } from '@features/performance/application/evaluation.usecases';

// --- infrastructure ---
const evaluationRepo = new MongooseEvaluationRepository();
const employeeGw = new MongooseEmployeeGateway();
const criterionGw = new MongooseCriterionGateway();
const payrollLockGw = new MongoosePayrollLockGateway();
const clock = new SystemClock();
const audit = new AuditServiceAdapter();
const events = new EventBusAdapter();

// --- application ---
export const evaluationUseCases = new EvaluationUseCases(
  evaluationRepo, employeeGw, criterionGw, payrollLockGw, audit, events, clock,
);
