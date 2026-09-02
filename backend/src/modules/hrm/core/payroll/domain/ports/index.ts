/**
 * Ports — the abstractions the payroll application (use-cases) depends on.
 * Concrete implementations live in `infrastructure/`. IDs cross the boundary as
 * strings; `Tx` is an opaque transaction handle (a Mongoose ClientSession under
 * the hood). Read-models are the plain shapes adapters return (lean docs /
 * `toJSON()` output) so HTTP response shapes are preserved exactly.
 */
import type { IPayroll } from '@modules/hrm/adapters/persistence/mongoose/models/payroll.model';
import type { ISalaryPolicyConfig } from '@modules/hrm/adapters/persistence/mongoose/models/salary-policy-config.model';
import type { IEmployeeContract } from '@modules/hrm/adapters/persistence/mongoose/models/employee-contract.model';
import type { IMonthlyEvaluation } from '@modules/hrm/adapters/persistence/mongoose/models/monthly-evaluation.model';
import type { IEmployeeTaxProfile } from '@modules/hrm/adapters/persistence/mongoose/models/employee-tax-profile.model';
import type { IAllowance } from '@modules/hrm/adapters/persistence/mongoose/models/allowance.model';
import type { IBonus } from '@modules/hrm/adapters/persistence/mongoose/models/bonus.model';
import type { IDeduction } from '@modules/hrm/adapters/persistence/mongoose/models/deduction.model';
import type { AttendanceStatus } from '@modules/hrm/adapters/persistence/mongoose/models/attendance.model';
import type { AttendanceSummary } from '@modules/hrm/core/payroll/domain/attendance-summary';
import type {
  CreateAllowanceDto,
  UpdateAllowanceDto,
  CreateBonusDto,
  UpdateBonusDto,
  CreateDeductionDto,
  UpdateDeductionDto,
  UpsertTaxProfileDto,
} from '@modules/hrm/core/payroll/dto/compensation.dto';
import type { PeriodReader, PeriodLifecycle } from '@modules/hrm/core/period/domain/ports';

export type Id = string;
export type Tx = unknown;

// ---- read-models ----

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
  /** Ngày vào làm — mốc bắt đầu khoảng thuộc bảng lương. */
  hireDate: Date;
  /** Ngày nghỉ việc; `null` = còn làm. */
  terminationDate?: Date | null;
}
export interface EmployeeIdCode {
  _id: unknown;
  employeeCode: string;
  hireDate: Date;
  terminationDate?: Date | null;
}
export interface ProfileName {
  employeeId: unknown;
  firstName?: string;
  middleName?: string;
  lastName?: string;
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
  deleteDrafts(periodId: Id): Promise<number>;
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
  /**
   * Ứng viên tính lương của MỘT kỳ: người có khoảng làm việc giao với kỳ đó —
   * không lọc theo trạng thái hiện tại. Nhờ vậy người mới (`onboarding`) và
   * người đã nghỉ vẫn tính/tính lại được lương của kỳ họ còn đi làm.
   */
  listForRun(periodStart: Date, periodEnd: Date): Promise<{ _id: unknown }[]>;
  listNonTerminatedIds(): Promise<{ _id: unknown }[]>;
  listNonTerminatedWithCode(): Promise<EmployeeIdCode[]>;
}

export interface ContractGateway {
  activeEmployeeIds(employeeIds: Id[]): Promise<string[]>;
  /**
   * Mọi hợp đồng có hiệu lực CHỒNG LÊN [from, to], sắp xếp theo `startDate` tăng
   * dần. Lọc theo NGÀY HIỆU LỰC chứ không theo `status`: hợp đồng đã `expired`
   * vẫn là dữ liệu đúng cho đoạn quá khứ của kỳ lương.
   */
  findOverlapping(employeeId: Id, from: Date, to: Date): Promise<ContractRecord[]>;
  /** Như trên nhưng cho nhiều nhân viên trong MỘT truy vấn (dùng cho preflight). */
  findOverlappingForMany(
    employeeIds: Id[],
    from: Date,
    to: Date,
  ): Promise<Map<string, ContractRecord[]>>;
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
