/**
 * Ports — the abstractions the payroll application (use-cases) depends on.
 * Concrete implementations live in `infrastructure/`. IDs cross the boundary as
 * strings; `Tx` is an opaque transaction handle (a Mongoose ClientSession under
 * the hood). Read-models are the plain shapes adapters return (lean docs /
 * `toJSON()` output) so HTTP response shapes are preserved exactly.
 */
import type { IPayrollPeriod } from '@shared/models/payroll-period.model';
import type { IPayroll } from '@shared/models/payroll.model';
import type { ISalaryPolicyConfig } from '@shared/models/salary-policy-config.model';
import type { IEmployeeContract } from '@shared/models/employee-contract.model';
import type { IMonthlyEvaluation } from '@shared/models/monthly-evaluation.model';
import type { IEmployeeTaxProfile } from '@shared/models/employee-tax-profile.model';
import type { IAllowance } from '@shared/models/allowance.model';
import type { IBonus } from '@shared/models/bonus.model';
import type { IDeduction } from '@shared/models/deduction.model';
import type { AttendanceStatus } from '@shared/models/attendance.model';
import type { AttendanceSummary } from '@features/payroll/domain/attendance-summary';
import type {
  CreateAllowanceDto,
  UpdateAllowanceDto,
  CreateBonusDto,
  UpdateBonusDto,
  CreateDeductionDto,
  UpdateDeductionDto,
  UpsertTaxProfileDto,
} from '@features/payroll/dto/compensation.dto';
import type { CreatePeriodDto, UpdatePeriodDto } from '@features/payroll/dto/payroll-period.dto';

export type Id = string;
export type Tx = unknown;

// ---- read-models ----

/** A payroll period as returned to callers (mirrors `doc.toJSON()`). */
export type PeriodRecord = IPayrollPeriod & { _id: unknown; id?: string };
export type PolicyRecord = ISalaryPolicyConfig & { _id: unknown };
export type ContractRecord = IEmployeeContract & { _id: unknown };
export type EvaluationRecord = IMonthlyEvaluation & { _id: unknown };
export type TaxProfileRecord = IEmployeeTaxProfile & { _id: unknown };
export type AllowanceRecord = IAllowance & { _id: unknown };
export type BonusRecord = IBonus & { _id: unknown };
export type DeductionRecord = IDeduction & { _id: unknown };

export interface EmployeeLean {
  _id: unknown;
  shiftId?: unknown;
  salaryZone?: string;
}
export interface EmployeeIdCode {
  _id: unknown;
  employeeCode: string;
}
export interface ProfileName {
  employeeId: unknown;
  firstName?: string;
  middleName?: string;
  lastName?: string;
}

// ---- period repository ----

export interface PayrollPeriodRepository {
  list(): Promise<PeriodRecord[]>;
  findById(id: Id): Promise<PeriodRecord | null>;
  findByName(name: string): Promise<PeriodRecord | null>;
  namesByIds(ids: Id[]): Promise<{ _id: unknown; name: string }[]>;
  create(input: CreatePeriodDto & { standardWorkDays: number }): Promise<PeriodRecord>;
  update(id: Id, patch: UpdatePeriodDto): Promise<PeriodRecord | null>;
  delete(id: Id): Promise<void>;
  markClosed(id: Id, byUserId: Id): Promise<PeriodRecord | null>;
  reopenToOpen(id: Id): Promise<PeriodRecord | null>;
  lockAttendance(id: Id, byUserId: Id): Promise<PeriodRecord | null>;
  unlockAttendance(id: Id): Promise<PeriodRecord | null>;
  markProcessing(id: Id, tx: Tx): Promise<void>;
  markPaid(id: Id, tx: Tx): Promise<void>;
}

// ---- computed-payroll repository ----

export interface ListPayrollFilter {
  payrollPeriodId?: string;
  employeeId?: string;
  status?: string;
}

export interface PayrollTotalsRow {
  _id: string;
  count: number;
  gross: unknown;
  net: unknown;
}

export interface PayrollRepository {
  findById(id: Id): Promise<IPayroll | null>;
  findStatusById(id: Id): Promise<{ _id: unknown; status: string } | null>;
  findExisting(periodId: Id, employeeId: Id): Promise<{ status: string } | null>;
  paginate(
    filter: ListPayrollFilter,
    page: number,
    limit: number,
  ): Promise<{ items: IPayroll[]; total: number }>;
  totalsForPeriod(periodId: Id): Promise<PayrollTotalsRow[]>;
  exportRows(periodId: Id): Promise<Record<string, unknown>[]>;
  countByPeriod(periodId: Id): Promise<number>;
  countDrafts(periodId: Id, employeeId?: Id): Promise<number>;
  countApproved(periodId: Id): Promise<number>;
  reopenApprovedToDraft(periodId: Id): Promise<number>;
  upsertComputed(periodId: Id, employeeId: Id, doc: IPayroll, tx: Tx): Promise<IPayroll>;
  approveMany(periodId: Id, employeeId: Id | undefined, approverUserId: Id, tx: Tx): Promise<void>;
  markPaidMany(periodId: Id, paidAt: Date, tx: Tx): Promise<void>;
  revertToDraft(payrollId: Id): Promise<void>;
}

// ---- compensation repositories ----

export interface AllowanceRepository {
  listByEmployee(employeeId: Id): Promise<AllowanceRecord[]>;
  create(input: CreateAllowanceDto): Promise<AllowanceRecord>;
  update(id: Id, patch: UpdateAllowanceDto): Promise<AllowanceRecord | null>;
  delete(id: Id): Promise<boolean>;
  findActiveForPeriod(employeeId: Id, start: Date, end: Date): Promise<AllowanceRecord[]>;
}

export interface BonusRepository {
  listByEmployee(employeeId: Id): Promise<BonusRecord[]>;
  create(input: CreateBonusDto, approvedByUserId: Id): Promise<BonusRecord>;
  update(id: Id, patch: UpdateBonusDto): Promise<BonusRecord | null>;
  delete(id: Id): Promise<boolean>;
  findForPeriod(employeeId: Id, periodId: Id): Promise<BonusRecord[]>;
}

export interface DeductionRepository {
  listByEmployee(employeeId: Id): Promise<DeductionRecord[]>;
  create(input: CreateDeductionDto): Promise<DeductionRecord>;
  update(id: Id, patch: UpdateDeductionDto): Promise<DeductionRecord | null>;
  delete(id: Id): Promise<boolean>;
  findActiveForPeriod(
    employeeId: Id,
    periodId: Id,
    start: Date,
    end: Date,
  ): Promise<DeductionRecord[]>;
}

export interface TaxProfileRepository {
  listByEmployee(employeeId: Id): Promise<TaxProfileRecord[]>;
  create(input: UpsertTaxProfileDto): Promise<TaxProfileRecord>;
  findEffective(employeeId: Id, date: Date): Promise<TaxProfileRecord | null>;
  employeeIdsEffective(employeeIds: Id[], date: Date): Promise<string[]>;
}

// ---- cross-model gateways ----

export interface EmployeeGateway {
  findByIdLean(id: Id): Promise<EmployeeLean | null>;
  findByUserId(userId: Id): Promise<{ _id: unknown } | null>;
  listForRun(): Promise<{ _id: unknown }[]>;
  listNonTerminatedIds(): Promise<{ _id: unknown }[]>;
  listNonTerminatedWithCode(): Promise<EmployeeIdCode[]>;
}

export interface ContractGateway {
  findActive(employeeId: Id): Promise<ContractRecord | null>;
  activeEmployeeIds(employeeIds: Id[]): Promise<string[]>;
}

export interface ShiftGateway {
  workingDays(shiftId: Id): Promise<number[] | null>;
}

export interface SalaryPolicyGateway {
  effectiveAt(date: Date): Promise<PolicyRecord | null>;
}

export interface EvaluationGateway {
  findForEmployeePeriod(employeeId: Id, periodId: Id): Promise<EvaluationRecord | null>;
  finalizedEmployeeIds(periodId: Id): Promise<string[]>;
}

export interface EmployeeProfileGateway {
  namesFor(employeeIds: Id[]): Promise<ProfileName[]>;
}

export interface AttendanceGateway {
  aggregatePeriod(employeeId: Id, start: Date, end: Date): Promise<AttendanceSummary>;
  listStatusesInRange(start: Date, end: Date): Promise<{ employeeId: unknown; status: AttendanceStatus }[]>;
}

export interface WorkCalendarGateway {
  standardWorkDaysInRange(start: Date, end: Date, workingDays?: number[]): Promise<number>;
  companyStandardWorkDays(): Promise<number | undefined>;
}

// ---- infrastructure services ----

export interface Clock {
  now(): Date;
}

export interface AuditPort {
  record(entry: {
    userId: string;
    resource: string;
    action: string;
    resourceId?: string;
    changes?: Record<string, unknown>;
  }): Promise<void>;
}

export interface EventsPort {
  attendanceLocked(p: { periodId: string; periodName: string }): void;
  payrollApproved(p: { periodId: string; count: number; approvedBy: string }): void;
  payrollPaid(p: { periodId: string; count: number; paidBy: string }): void;
}

export interface UnitOfWork {
  withTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}
