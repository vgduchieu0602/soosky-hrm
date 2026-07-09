import { Types, type ClientSession } from 'mongoose';
import { Employee } from '@shared/models/employee.model';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { CompanyConfig } from '@shared/models/company-config.model';
import { Shift, defaultWeightForType } from '@shared/models/shift.model';
import { PayrollPeriod } from '@shared/models/payroll-period.model';
import { DEFAULT_POLICY, type AttendancePolicy } from '@features/attendance/domain/attendance-calc';
import { annualQuotaFrom } from '@features/attendance/domain/leave-policy';
import type {
  EmployeeGateway,
  ShiftWindowGateway,
  ShiftDefRecord,
  PolicyGateway,
  PayrollLockGateway,
  Id,
  Tx,
} from '@features/attendance/domain/ports';
import type { AttendanceSession } from '@shared/models/attendance.model';

const oid = (id: Id) => new Types.ObjectId(id);

export class MongooseEmployeeGateway implements EmployeeGateway {
  async findByUserId(userId: Id): Promise<{ _id: string } | null> {
    const e = await Employee.findOne({ userId }).select('_id').lean();
    return e ? { _id: String(e._id) } : null;
  }
  async findById(id: Id): Promise<{ _id: string } | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const e = await Employee.findById(id).select('_id').lean();
    return e ? { _id: String(e._id) } : null;
  }
  async isOfficial(employeeId: Id, tx?: Tx): Promise<boolean> {
    const q = EmployeeContractModel.findOne({ employeeId: oid(employeeId), status: 'active' }).select('employmentStatus');
    const c = await (tx ? q.session(tx as ClientSession) : q).lean();
    return c?.employmentStatus === 'official';
  }
}

export class MongooseShiftWindowGateway implements ShiftWindowGateway {
  async findDefaultShiftWindow() {
    const s =
      (await Shift.findOne({ status: 'active', type: 'full_day' }).lean()) ??
      (await Shift.findOne({ status: 'active' }).lean());
    if (!s) return null;
    return { id: String(s._id), startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes };
  }
  async findShiftWindow(shiftId: Id) {
    if (!Types.ObjectId.isValid(shiftId)) return null;
    const s = await Shift.findById(shiftId).lean();
    if (!s) return null;
    return { startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes };
  }
  listActiveShifts() {
    return Shift.find({ status: 'active' }).sort({ startTime: 1 }).lean() as unknown as Promise<Record<string, unknown>[]>;
  }
  async listActiveShiftDefs(): Promise<ShiftDefRecord[]> {
    const rows = await Shift.find({ status: 'active' }).sort({ startTime: 1 }).lean();
    return rows.map((s) => ({
      id: String(s._id),
      type: (s.type ?? 'full_day') as AttendanceSession,
      startTime: s.startTime,
      endTime: s.endTime,
      breakMinutes: s.breakMinutes ?? 0,
      weight: s.weight ?? defaultWeightForType(s.type ?? 'full_day'),
      workingDays: s.workingDays ?? [1, 2, 3, 4, 5],
      effectiveFrom: s.effectiveFrom ?? null,
      effectiveTo: s.effectiveTo ?? null,
    }));
  }
}

export class MongoosePolicyGateway implements PolicyGateway {
  async loadPolicy(): Promise<AttendancePolicy> {
    const cfg = await CompanyConfig.findOne({ key: 'global' }).lean();
    if (!cfg) return DEFAULT_POLICY;
    return {
      timezone: cfg.timezone || DEFAULT_POLICY.timezone,
      graceLateMin: cfg.graceLateMinutes ?? DEFAULT_POLICY.graceLateMin,
      graceEarlyMin: cfg.graceEarlyMinutes ?? DEFAULT_POLICY.graceEarlyMin,
      earlyLeaveToleranceMin: cfg.earlyLeaveToleranceMinutes ?? DEFAULT_POLICY.earlyLeaveToleranceMin,
      lateArrivalToleranceMin: cfg.lateArrivalToleranceMinutes ?? DEFAULT_POLICY.lateArrivalToleranceMin,
    };
  }
  async annualQuota(): Promise<number> {
    const cfg = await CompanyConfig.findOne({ key: 'global' }).select('leaveQuotas').lean();
    const q = (cfg?.leaveQuotas as Record<string, number> | undefined)?.annual;
    return annualQuotaFrom(q);
  }
}

export class MongoosePayrollLockGateway implements PayrollLockGateway {
  async lockedPeriodName(date: Date): Promise<string | null> {
    const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const locked = await PayrollPeriod.findOne({
      startDate: { $lte: day },
      endDate: { $gte: day },
      attendanceLockedAt: { $ne: null },
    })
      .select('name')
      .lean();
    return locked?.name ?? null;
  }
}
