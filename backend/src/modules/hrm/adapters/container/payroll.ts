/**
 * Composition root — the only place that knows about concrete adapters. Wires
 * the Mongoose infrastructure into the payroll use-cases and exposes them for
 * the HTTP layer + the feature's public surface.
 */
import {
  MongoosePayrollRepository,
  MongooseAllowanceRepository,
  MongooseBonusRepository,
  MongooseDeductionRepository,
  MongooseTaxProfileRepository,
} from '@modules/hrm/adapters/persistence/mongoose/payroll/repositories';
import {
  MongooseEmployeeGateway,
  MongooseContractGateway,
  MongooseShiftGateway,
  MongooseSalaryPolicyGateway,
  MongooseEvaluationGateway,
  MongooseEmployeeProfileGateway,
  MongooseAttendanceGateway,
  MongooseWorkCalendarGateway,
  MongoosePayrollReadiness,
} from '@modules/hrm/adapters/persistence/mongoose/payroll/gateways';
import {
  SystemClock,
  AuditServiceAdapter,
  EventBusAdapter,
  MongooseUnitOfWork,
} from '@modules/hrm/adapters/services/payroll.services';
import {
  AllowanceUseCases,
  BonusUseCases,
  DeductionUseCases,
  TaxProfileUseCases,
} from '@modules/hrm/core/payroll/app/compensation.usecases';
import { periodUseCases } from '@modules/hrm/adapters/container/period';
import { MongoosePeriodGateway } from '@modules/hrm/adapters/persistence/mongoose/period/gateways';
import { PayrollUseCases } from '@modules/hrm/core/payroll/app/payroll.usecases';
import { PayrollApprovalUseCases } from '@modules/hrm/core/payroll/app/payroll-approval.usecases';
import { RunPayrollUseCases, type RunOptions } from '@modules/hrm/core/payroll/app/payroll-run.usecases';

// --- infrastructure ---
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
const periodGateway = new MongoosePeriodGateway();

const clock = new SystemClock();
const audit = new AuditServiceAdapter();
const events = new EventBusAdapter();
const uow = new MongooseUnitOfWork();

void clock; // reserved for future time-dependent rules

// --- application ---
export const payrollUseCases = new PayrollUseCases(
  payrollRepo, periodGateway, periodGateway, policyGw, employeeGw, contractGw, evaluationGw, attendanceGw, taxProfileRepo, profileGw, clock,
);
export const approvalUseCases = new PayrollApprovalUseCases(periodGateway, periodGateway, payrollRepo, audit, events, uow, clock);
export const runUseCases = new RunPayrollUseCases(
  periodGateway, periodGateway, payrollRepo, employeeGw, contractGw, shiftGw, policyGw, evaluationGw,
  taxProfileRepo, allowanceRepo, bonusRepo, deductionRepo, attendanceGw, workCalendarGw, uow, clock,
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
