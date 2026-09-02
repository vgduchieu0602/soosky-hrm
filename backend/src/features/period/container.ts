import { MongoosePeriodRepository } from './infrastructure/period.repository.mongoose';
import { MongoosePeriodGateway } from './infrastructure/gateways.mongoose';
import {
  MongooseEmployeeGateway,
  MongooseEvaluationGateway,
  MongooseAttendanceGateway,
  MongooseWorkCalendarGateway,
  MongoosePayrollReadiness,
} from '@features/payroll/infrastructure/gateways.mongoose';
import { MongoosePayrollRepository } from '@features/payroll/infrastructure/repositories.mongoose';
import { AuditServiceAdapter, EventBusAdapter } from './infrastructure/services';
import { PeriodUseCases } from './application/period.usecases';
import { createPeriodRouter } from './interfaces/http/period.routes';

const periodRepo = new MongoosePeriodRepository();
export const periodGateway = new MongoosePeriodGateway();

// Sibling-feature gateways (period reaches into them only through ports).
const employeeGw = new MongooseEmployeeGateway();
const evaluationGw = new MongooseEvaluationGateway();
const attendanceGw = new MongooseAttendanceGateway();
const workCalendarGw = new MongooseWorkCalendarGateway();
const payrollReadiness = new MongoosePayrollReadiness(new MongoosePayrollRepository());

const audit = new AuditServiceAdapter();
const events = new EventBusAdapter();

export const periodUseCases = new PeriodUseCases(
  periodRepo,
  employeeGw,
  evaluationGw,
  attendanceGw,
  workCalendarGw,
  payrollReadiness,
  audit,
  events,
);

export const periodRouter = createPeriodRouter(periodUseCases);
