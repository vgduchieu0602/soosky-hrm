import { Employee } from '@shared/models/employee.model';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { EmployeeProfile } from '@shared/models/employee-profile.model';
import { Shift } from '@shared/models/shift.model';
import {
  DEFAULT_INTERN_STIPEND,
  DEFAULT_PROBATION_PAY_RATE,
  SalaryPolicyConfig,
} from '@shared/models/salary-policy-config.model';
import { MonthlyEvaluation } from '@shared/models/monthly-evaluation.model';
import { CompanyConfig } from '@shared/models/company-config.model';
import { Attendance, type AttendanceStatus } from '@shared/models/attendance.model';
import type { PayrollReadinessPort } from '@features/period/domain/ports';
import { MongoosePayrollRepository } from './repositories.mongoose';
import {
  summarizeAttendance,
  dedupeByDay,
  type AttendanceRow,
  type AttendanceSummary,
} from '@features/payroll/domain/attendance-summary';
import { standardWorkDaysInRange } from '@features/payroll/infrastructure/workdays';
import type {
  EmployeeGateway,
  ContractGateway,
  ShiftGateway,
  SalaryPolicyGateway,
  EvaluationGateway,
  EmployeeProfileGateway,
  AttendanceGateway,
  WorkCalendarGateway,
  EmployeeLean,
  EmployeeIdCode,
  ProfileName,
  ContractRecord,
  PolicyRecord,
  EvaluationRecord,
  Id,
} from '@features/payroll/domain/ports';

export class MongooseEmployeeGateway implements EmployeeGateway {
  findByIdLean(id: Id) {
    return Employee.findById(id)
      .select('_id shiftId salaryZone hireDate terminationDate')
      .lean() as unknown as Promise<EmployeeLean | null>;
  }
  findByUserId(userId: Id) {
    return Employee.findOne({ userId }).select('_id').lean() as unknown as Promise<{ _id: unknown } | null>;
  }
  listForRun(periodStart: Date, periodEnd: Date) {
    // Thành viên của kỳ xét theo KHOẢNG LÀM VIỆC, không theo trạng thái hiện tại:
    // trạng thái chỉ mô tả hôm nay, còn bảng lương tháng 8 phải tính được cả
    // người tháng 9 mới nghỉ.
    return Employee.find({
      hireDate: { $lte: periodEnd },
      $or: [{ terminationDate: null }, { terminationDate: { $gte: periodStart } }],
    })
      .select('_id')
      .lean() as unknown as Promise<{ _id: unknown }[]>;
  }
  listNonTerminatedIds() {
    return Employee.find({ status: { $ne: 'terminated' } })
      .select('_id')
      .lean() as unknown as Promise<{ _id: unknown }[]>;
  }
  listNonTerminatedWithCode() {
    return Employee.find({ status: { $nin: ['terminated'] } })
      .select('_id employeeCode hireDate terminationDate')
      .lean() as unknown as Promise<EmployeeIdCode[]>;
  }
}

export class MongooseContractGateway implements ContractGateway {
  async activeEmployeeIds(employeeIds: Id[]) {
    const rows = await EmployeeContractModel.find({ employeeId: { $in: employeeIds }, status: 'active' })
      .select('employeeId')
      .lean();
    return rows.map((c) => String(c.employeeId));
  }

  /**
   * Điều kiện chồng lấn theo ngày hiệu lực (KHÔNG lọc `status`):
   *   startDate <= to  AND  (endDate == null OR endDate >= from)
   * Một truy vấn cho cả kỳ — không dò từng ngày.
   */
  findOverlapping(employeeId: Id, from: Date, to: Date) {
    return EmployeeContractModel.find({
      employeeId,
      startDate: { $lte: to },
      $or: [{ endDate: null }, { endDate: { $gte: from } }],
    })
      .sort({ startDate: 1 })
      .lean() as unknown as Promise<ContractRecord[]>;
  }

  async findOverlappingForMany(employeeIds: Id[], from: Date, to: Date) {
    const rows = (await EmployeeContractModel.find({
      employeeId: { $in: employeeIds },
      startDate: { $lte: to },
      $or: [{ endDate: null }, { endDate: { $gte: from } }],
    })
      .sort({ startDate: 1 })
      .lean()) as unknown as ContractRecord[];

    const byEmployee = new Map<string, ContractRecord[]>();
    for (const row of rows) {
      const key = String((row as { employeeId: unknown }).employeeId);
      const bucket = byEmployee.get(key);
      if (bucket) bucket.push(row);
      else byEmployee.set(key, [row]);
    }
    return byEmployee;
  }
}

export class MongooseShiftGateway implements ShiftGateway {
  async workingDays(shiftId: Id) {
    const shift = await Shift.findById(shiftId).select('workingDays').lean();
    return shift?.workingDays ?? null;
  }
}

export class MongooseSalaryPolicyGateway implements SalaryPolicyGateway {
  async effectiveAt(date: Date) {
    const policy = await SalaryPolicyConfig.findOne({ effectiveFrom: { $lte: date } })
      .sort({ effectiveFrom: -1 })
      .lean();
    if (!policy) return null;

    // `lean()` does not backfill defaults for historical documents. Normalize at
    // the policy boundary so the payroll engine never carries business constants.
    return {
      ...policy,
      internStipend: policy.internStipend ?? DEFAULT_INTERN_STIPEND,
      probationPayRate: policy.probationPayRate ?? DEFAULT_PROBATION_PAY_RATE,
    } as unknown as PolicyRecord;
  }
}

export class MongooseEvaluationGateway implements EvaluationGateway {
  findForEmployeePeriod(employeeId: Id, periodId: Id) {
    return MonthlyEvaluation.findOne({ employeeId, payrollPeriodId: periodId })
      .lean() as unknown as Promise<EvaluationRecord | null>;
  }
  async finalizedEmployeeIds(periodId: Id) {
    const rows = await MonthlyEvaluation.find({
      payrollPeriodId: periodId,
      status: { $in: ['approved', 'acknowledged'] },
    })
      .select('employeeId')
      .lean();
    return rows.map((e) => String(e.employeeId));
  }
}

export class MongooseEmployeeProfileGateway implements EmployeeProfileGateway {
  namesFor(employeeIds: Id[]) {
    return EmployeeProfile.find({ employeeId: { $in: employeeIds } })
      .select('employeeId firstName middleName lastName')
      .lean() as unknown as Promise<ProfileName[]>;
  }
}

export class MongooseAttendanceGateway implements AttendanceGateway {
  async aggregatePeriod(employeeId: Id, start: Date, end: Date): Promise<AttendanceSummary> {
    const raw = await Attendance.find({ employeeId, date: { $gte: start, $lte: end } })
      .select('session status workHours date')
      .lean<Array<AttendanceRow & { date: Date }>>();
    return summarizeAttendance(dedupeByDay(raw));
  }
  listStatusesInRange(start: Date, end: Date) {
    return Attendance.find({ date: { $gte: start, $lte: end } })
      .select('employeeId status')
      .lean() as unknown as Promise<{ employeeId: unknown; status: AttendanceStatus }[]>;
  }
}

export class MongooseWorkCalendarGateway implements WorkCalendarGateway {
  standardWorkDaysInRange(start: Date, end: Date, workingDays?: number[]) {
    return standardWorkDaysInRange(start, end, workingDays);
  }
  async companyStandardWorkDays() {
    const config = await CompanyConfig.findOne({ key: 'global' }).lean();
    return config?.standardWorkDays;
  }
}

/**
 * Implements the period feature's `PayrollReadinessPort`. The period needs to
 * know whether a period still has draft / any computed-payroll rows before it
 * closes or deletes — this is the single inbound dependency the period has on
 * payroll. Importing `{ PeriodReader, PeriodLifecycle }` from `@features/period`
 * here is type-only, so there is no runtime circular dependency.
 */
export class MongoosePayrollReadiness implements PayrollReadinessPort {
  constructor(private readonly repo: MongoosePayrollRepository) {}
  countDrafts(periodId: Id, employeeId?: Id) {
    return this.repo.countDrafts(periodId, employeeId);
  }
  countByPeriod(periodId: Id) {
    return this.repo.countByPeriod(periodId);
  }
}
