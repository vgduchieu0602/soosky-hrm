import { Types } from 'mongoose';
import { Employee } from '@shared/models/employee.model';
import { EmployeeProfile } from '@shared/models/employee-profile.model';
import { Department } from '@shared/models/department.model';
import { Attendance } from '@shared/models/attendance.model';
import { LeaveRequest } from '@shared/models/leave-request.model';
import { Payroll } from '@shared/models/payroll.model';
import { MonthlyEvaluation } from '@shared/models/monthly-evaluation.model';
import { AuditLog } from '@shared/models/audit-log.model';
import type { PeriodReader } from '@features/period/domain/ports';
import type {
  DashboardRepository,
  EmployeeCounts,
  DeptCount,
  DeptName,
  AttStatusCount,
  MonthlyTrendRow,
  DailyTrendRow,
  LeaveDoc,
  EmployeeLookupData,
  PayrollPeriodInfo,
  PayrollRow,
  EvalRow,
  AuditRow,
} from '@features/dashboard/domain/ports';

export class MongooseDashboardRepository implements DashboardRepository {
  constructor(private readonly periodReader: PeriodReader) {}
  async employeeCounts(monthStart: Date): Promise<EmployeeCounts> {
    const [total, active, newHires] = await Promise.all([
      Employee.countDocuments({ status: { $ne: 'terminated' } }),
      Employee.countDocuments({ status: 'active' }),
      Employee.countDocuments({ hireDate: { $gte: monthStart }, status: { $ne: 'terminated' } }),
    ]);
    return { total, active, newHires };
  }

  async departmentDistribution(): Promise<DeptCount[]> {
    const agg = await Employee.aggregate<{ _id: Types.ObjectId | null; count: number }>([
      { $match: { status: { $ne: 'terminated' } } },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return agg.map((d) => ({ departmentId: d._id ? String(d._id) : null, count: d.count }));
  }

  async departmentNames(ids: string[]): Promise<DeptName[]> {
    const docs = await Department.find({ _id: { $in: ids } })
      .select('name')
      .lean();
    return docs.map((d) => ({ _id: String(d._id), name: d.name }));
  }

  async attendanceTodayByStatus(start: Date, end: Date): Promise<AttStatusCount[]> {
    const agg = await Attendance.aggregate<{ _id: string; count: number }>([
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return agg.map((a) => ({ status: a._id, count: a.count }));
  }

  async attendanceMonthlyTrend(yearStart: Date): Promise<MonthlyTrendRow[]> {
    const agg = await Attendance.aggregate<{
      _id: number;
      total: number;
      present: number;
      late: number;
    }>([
      { $match: { date: { $gte: yearStart } } },
      {
        $group: {
          _id: { $month: '$date' },
          total: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $in: ['$status', ['present', 'early_leave', 'late']] }, 1, 0] },
          },
          late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        },
      },
    ]);
    return agg.map((t) => ({ month: t._id, total: t.total, present: t.present, late: t.late }));
  }

  async attendanceWeeklyTrend(start: Date, end: Date): Promise<DailyTrendRow[]> {
    const agg = await Attendance.aggregate<{
      _id: string;
      total: number;
      present: number;
      late: number;
    }>([
      { $match: { date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          total: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $in: ['$status', ['present', 'early_leave', 'late']] }, 1, 0] },
          },
          late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        },
      },
    ]);
    return agg.map((d) => ({ day: d._id, total: d.total, present: d.present, late: d.late }));
  }

  leavePendingCount(): Promise<number> {
    return LeaveRequest.countDocuments({ status: 'pending' });
  }

  leaveOnTodayCount(start: Date, end: Date): Promise<number> {
    return LeaveRequest.countDocuments({
      status: 'approved',
      startDate: { $lte: end },
      endDate: { $gte: start },
    });
  }

  async latestPendingLeaves(limit: number): Promise<LeaveDoc[]> {
    const docs = await LeaveRequest.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map(mapLeaveDoc);
  }

  async upcomingApprovedLeaves(after: Date, until: Date, limit: number): Promise<LeaveDoc[]> {
    const docs = await LeaveRequest.find({
      status: 'approved',
      startDate: { $gt: after, $lte: until },
    })
      .sort({ startDate: 1 })
      .limit(limit)
      .lean();
    return docs.map(mapLeaveDoc);
  }

  async employeeLookup(ids: string[]): Promise<EmployeeLookupData> {
    const objIds = ids.map((id) => new Types.ObjectId(id));
    const [emps, profiles] = await Promise.all([
      Employee.find({ _id: { $in: objIds } })
        .select('employeeCode departmentId positionId')
        .lean(),
      EmployeeProfile.find({ employeeId: { $in: objIds } })
        .select('employeeId firstName middleName lastName')
        .lean(),
    ]);
    const deptIds = [...new Set(emps.map((e) => String(e.departmentId)).filter(Boolean))];
    const depts = await Department.find({ _id: { $in: deptIds } })
      .select('name')
      .lean();
    return {
      employees: emps.map((e) => ({
        _id: String(e._id),
        employeeCode: e.employeeCode,
        departmentId: e.departmentId ? String(e.departmentId) : null,
      })),
      profiles: profiles.map((p) => ({
        employeeId: String(p.employeeId),
        firstName: p.firstName,
        middleName: p.middleName,
        lastName: p.lastName,
      })),
      departments: depts.map((d) => ({ _id: String(d._id), name: d.name })),
    };
  }

  async latestPayrollPeriod(): Promise<PayrollPeriodInfo | null> {
    const period = await this.periodReader.findLatest();
    if (!period) return null;
    return {
      _id: String(period._id),
      name: period.name,
      status: period.status,
      payDate: period.payDate,
    };
  }

  async payrollRows(periodId: string): Promise<PayrollRow[]> {
    const rows = await Payroll.find({ payrollPeriodId: new Types.ObjectId(periodId) })
      .select('grossSalary netSalary status')
      .lean();
    return rows.map((r) => ({
      grossSalary: r.grossSalary,
      netSalary: r.netSalary,
      status: r.status,
    }));
  }

  async topEvaluations(limit: number): Promise<EvalRow[]> {
    const evals = await MonthlyEvaluation.aggregate<{
      employeeId: Types.ObjectId;
      score: number;
    }>([
      { $match: { status: { $in: ['approved', 'acknowledged'] } } },
      { $sort: { updatedAt: -1 } },
      {
        $group: {
          _id: '$employeeId',
          score: { $first: { $add: ['$performanceRatio', '$goalRatio'] } },
        },
      },
      { $project: { _id: 0, employeeId: '$_id', score: 1 } },
      { $sort: { score: -1 } },
      { $limit: limit },
    ]);
    return evals.map((e) => ({ employeeId: String(e.employeeId), score: e.score }));
  }

  async recentAuditLogs(limit: number): Promise<AuditRow[]> {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(limit).lean();
    return logs.map((l) => ({ action: l.action, resource: l.resource, timestamp: l.timestamp }));
  }
}

function mapLeaveDoc(l: {
  _id: unknown;
  employeeId: unknown;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  createdAt?: Date;
}): LeaveDoc {
  return {
    _id: String(l._id),
    employeeId: String(l.employeeId),
    leaveType: l.leaveType,
    startDate: l.startDate,
    endDate: l.endDate,
    days: l.days,
    createdAt: l.createdAt,
  };
}
