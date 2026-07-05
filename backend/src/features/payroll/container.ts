/**
 * Composition root — the only place that knows about concrete adapters. Wires
 * the Mongoose infrastructure into the payroll use-cases and exposes them for
 * the HTTP layer + the feature's public surface.
 */
import {
  MongoosePayrollPeriodRepository,
  MongoosePayrollRepository,
  MongooseAllowanceRepository,
  MongooseBonusRepository,
  MongooseDeductionRepository,
  MongooseTaxProfileRepository,
} from '@features/payroll/infrastructure/repositories.mongoose';
import {
  MongooseEmployeeGateway,
  MongooseContractGateway,
  MongooseShiftGateway,
  MongooseSalaryPolicyGateway,
  MongooseEvaluationGateway,
  MongooseEmployeeProfileGateway,
  MongooseAttendanceGateway,
  MongooseWorkCalendarGateway,
} from '@features/payroll/infrastructure/gateways.mongoose';
import {
  SystemClock,
  AuditServiceAdapter,
  EventBusAdapter,
  MongooseUnitOfWork,
} from '@features/payroll/infrastructure/services';
import {
  AllowanceUseCases,
  BonusUseCases,
  DeductionUseCases,
  TaxProfileUseCases,
} from '@features/payroll/application/compensation.usecases';
import { PayrollPeriodUseCases } from '@features/payroll/application/payroll-period.usecases';
import { PayrollUseCases } from '@features/payroll/application/payroll.usecases';
import { PayrollApprovalUseCases } from '@features/payroll/application/payroll-approval.usecases';
import { RunPayrollUseCases, type RunOptions } from '@features/payroll/application/payroll-run.usecases';

// --- infrastructure ---
const periodRepo = new MongoosePayrollPeriodRepository();
const payrollRepo = new MongoosePayrollRepository();
const allowanceRepo = new MongooseAllowanceRepository();
const bonusRepo = new MongooseBonusRepository();
const deductionRepo = new MongooseDeductionRepository();
const taxProfileRepo = new MongooseTaxProfileRepository();

const employeeGw = new MongooseEmployeeGateway();
const contractGw = new MongooseContractGateway();
const shiftGw = new MongooseShiftGateway();
const policyGw = new MongooseSalaryPolicyGateway();
const evaluationGw = new MongooseEvaluationGateway();
const profileGw = new MongooseEmployeeProfileGateway();
const attendanceGw = new MongooseAttendanceGateway();
const workCalendarGw = new MongooseWorkCalendarGateway();

const clock = new SystemClock();
const audit = new AuditServiceAdapter();
const events = new EventBusAdapter();
const uow = new MongooseUnitOfWork();

void clock; // reserved for future time-dependent rules

// --- application ---
export const payrollPeriodUseCases = new PayrollPeriodUseCases(
  periodRepo, payrollRepo, employeeGw, attendanceGw, workCalendarGw, audit, events,
);
export const payrollUseCases = new PayrollUseCases(
  payrollRepo, periodRepo, policyGw, employeeGw, contractGw, evaluationGw, taxProfileRepo, profileGw,
);
export const approvalUseCases = new PayrollApprovalUseCases(periodRepo, payrollRepo, audit, events, uow);
export const runUseCases = new RunPayrollUseCases(
  periodRepo, payrollRepo, employeeGw, contractGw, shiftGw, policyGw, evaluationGw,
  taxProfileRepo, allowanceRepo, bonusRepo, deductionRepo, attendanceGw, workCalendarGw, uow,
);

export const allowanceUseCases = new AllowanceUseCases(allowanceRepo, audit);
export const bonusUseCases = new BonusUseCases(bonusRepo, audit);
export const deductionUseCases = new DeductionUseCases(deductionRepo, audit);
export const taxProfileUseCases = new TaxProfileUseCases(taxProfileRepo, audit);

// --- bound functions preserving the legacy public surface ---
export const runPayrollForEmployee = (periodId: string, employeeId: string, opts: RunOptions = {}) =>
  runUseCases.forEmployee(periodId, employeeId, opts);
export const runPayrollForPeriod = (periodId: string, opts: RunOptions = {}) =>
  runUseCases.forPeriod(periodId, opts);
export const approvePayroll = (periodId: string, approverUserId: string, employeeId?: string) =>
  approvalUseCases.approve(periodId, approverUserId, employeeId);
export const revertPayrollToDraft = (payrollId: string, userId: string) =>
  approvalUseCases.revert(payrollId, userId);
export const markPeriodPaid = (periodId: string, payerUserId: string) =>
  approvalUseCases.markPaid(periodId, payerUserId);
