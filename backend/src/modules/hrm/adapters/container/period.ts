import { MongoosePeriodRepository } from '@modules/hrm/adapters/persistence/mongoose/period/period.repository';
import { MongoosePeriodGateway } from '@modules/hrm/adapters/persistence/mongoose/period/gateways';
import {
  MongooseEmployeeGateway,
  MongooseEvaluationGateway,
  MongooseAttendanceGateway,
  MongooseWorkCalendarGateway,
  MongoosePayrollReadiness,
} from '@modules/hrm/adapters/persistence/mongoose/payroll/gateways';
import { MongoosePayrollRepository } from '@modules/hrm/adapters/persistence/mongoose/payroll/repositories';
import { AuditServiceAdapter, EventBusAdapter } from '@modules/hrm/adapters/services/period.services';
import { PeriodUseCases } from '@modules/hrm/core/period/app/period.usecases';
import { createPeriodRouter } from '@modules/hrm/adapters/http/period/period.routes';

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
