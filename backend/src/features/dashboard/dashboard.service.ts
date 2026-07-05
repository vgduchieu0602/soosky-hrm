import { Types } from 'mongoose';
import { Employee } from '@shared/models/employee.model';
import { EmployeeProfile } from '@shared/models/employee-profile.model';
import { Department } from '@shared/models/department.model';
import { Attendance } from '@shared/models/attendance.model';
import { LeaveRequest } from '@shared/models/leave-request.model';
import { PayrollPeriod } from '@shared/models/payroll-period.model';
import { Payroll } from '@shared/models/payroll.model';
import { MonthlyEvaluation } from '@shared/models/monthly-evaluation.model';
import { AuditLog } from '@shared/models/audit-log.model';

// ---- helpers -------------------------------------------------------------

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: 'Nghỉ phép năm',
  sick: 'Nghỉ ốm',
  personal: 'Việc riêng',
  unpaid: 'Nghỉ không lương',
  maternity: 'Nghỉ thai sản',
  paternity: 'Nghỉ vợ sinh',
};

const RESOURCE_ICON: Record<string, string> = {
  payroll: 'Wallet',
  leave: 'CalendarDays',
  employee: 'UserPlus',
  attendance: 'Clock',
  user: 'UserPlus',
  performance: 'Pencil',
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function initials(first?: string, last?: string) {
  return `${(last?.[0] ?? '').toUpperCase()}${(first?.[0] ?? '').toUpperCase()}` || '?';
}
function fullName(first?: string, middle?: string, last?: string) {
  return [last, middle, first].filter(Boolean).join(' ').trim() || 'N/A';
}
function fmtDMY(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
function fmtDM(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function relativeDays(from: Date, to: Date) {
  const diff = Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
  if (diff <= 0) return 'Hôm nay';
  if (diff === 1) return 'Ngày mai';
  return `Sau ${diff} ngày`;
}
function relativeTime(then: Date, now: Date) {
  const s = Math.round((now.getTime() - then.getTime()) / 1000);
  if (s < 60) return 'Vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86_400) return `${Math.floor(s / 3600)} giờ trước`;
  const d = Math.floor(s / 86_400);
  return d === 1 ? 'Hôm qua' : `${d} ngày trước`;
}
const toNum = (v: unknown) => (v == null ? 0 : Number(v.toString()));
function compactVnd(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1e6) return `${Math.round(n / 1e6)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(Math.round(n));
}

// Build a name/code/dept lookup for a set of employeeIds.
async function employeeLookup(ids: Types.ObjectId[]) {
  const [emps, profiles] = await Promise.all([
    Employee.find({ _id: { $in: ids } }).select('employeeCode departmentId positionId').lean(),
    EmployeeProfile.find({ employeeId: { $in: ids } })
      .select('employeeId firstName middleName lastName')
      .lean(),
  ]);
  const deptIds = [...new Set(emps.map((e) => String(e.departmentId)).filter(Boolean))];
  const depts = await Department.find({ _id: { $in: deptIds } }).select('name').lean();
  const deptName = new Map(depts.map((d) => [String(d._id), d.name]));
  const prof = new Map(profiles.map((p) => [String(p.employeeId), p]));
  const emp = new Map(emps.map((e) => [String(e._id), e]));
  return { deptName, prof, emp };
}

// ---- main ----------------------------------------------------------------

export const dashboardService = {
  async overview() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    // --- KPIs + department distribution (employee side) ---
    const [totalEmployees, activeEmployees, newHiresThisMonth, deptAgg] = await Promise.all([
      Employee.countDocuments({ status: { $ne: 'terminated' } }),
      Employee.countDocuments({ status: 'active' }),
      Employee.countDocuments({ hireDate: { $gte: monthStart }, status: { $ne: 'terminated' } }),
      Employee.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { status: { $ne: 'terminated' } } },
        { $group: { _id: '$departmentId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const deptDocs = await Department.find({
      _id: { $in: deptAgg.map((d) => d._id).filter(Boolean) },
    })
      .select('name')
      .lean();
    const deptNameById = new Map(deptDocs.map((d) => [String(d._id), d.name]));
    const departments = deptAgg.map((d) => ({
      name: deptNameById.get(String(d._id)) ?? 'Chưa phân bổ',
      count: d.count,
    }));

    // --- Attendance today ---
    const attToday = await Attendance.aggregate<{ _id: string; count: number }>([
      { $match: { date: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const attMap = new Map(attToday.map((a) => [a._id, a.count]));
    const onTime = (attMap.get('present') ?? 0) + (attMap.get('early_leave') ?? 0);
    const late = attMap.get('late') ?? 0;
    const onLeave =
      (attMap.get('leave_paid') ?? 0) +
      (attMap.get('leave_unpaid') ?? 0) +
      (attMap.get('holiday') ?? 0);
    const checkedTotal = [...attMap.values()].reduce((s, v) => s + v, 0);
    const notChecked = Math.max(activeEmployees - checkedTotal, 0);
    const attendanceToday = { onTime, late, onLeave, notChecked };

    // --- Attendance trend (per-month this year: attend% vs late%) ---
    const trendAgg = await Attendance.aggregate<{
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
    const byMonth = new Map(trendAgg.map((t) => [t._id, t]));
    const labels: string[] = [];
    const attend: number[] = [];
    const lateArr: number[] = [];
    for (let m = 1; m <= 12; m++) {
      const t = byMonth.get(m);
      labels.push(`T${m}`);
      attend.push(t && t.total ? Math.round((t.present / t.total) * 100) : 0);
      lateArr.push(t && t.total ? Math.round((t.late / t.total) * 100) : 0);
    }
    // Last 7 days (week view)
    const weekStart = startOfDay(new Date(todayStart));
    weekStart.setDate(weekStart.getDate() - 6);
    const weekAgg = await Attendance.aggregate<{
      _id: string;
      total: number;
      present: number;
      late: number;
    }>([
      { $match: { date: { $gte: weekStart, $lte: todayEnd } } },
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
    const byDay = new Map(weekAgg.map((d) => [d._id, d]));
    const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const wLabels: string[] = [];
    const wAttend: number[] = [];
    const wLate: number[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const t = byDay.get(key);
      wLabels.push(WD[day.getDay()]);
      wAttend.push(t && t.total ? Math.round((t.present / t.total) * 100) : 0);
      wLate.push(t && t.total ? Math.round((t.late / t.total) * 100) : 0);
    }
    const attendanceTrend = {
      week: { labels: wLabels, attend: wAttend, late: wLate },
      month: { labels, attend, late: lateArr },
    };

    // --- Leave: pending count + latest pending list + upcoming approved ---
    const in30 = new Date(todayStart);
    in30.setDate(in30.getDate() + 30);
    const [pendingCount, onLeaveTodayCount, pendingDocs, upcomingDocs] = await Promise.all([
      LeaveRequest.countDocuments({ status: 'pending' }),
      LeaveRequest.countDocuments({
        status: 'approved',
        startDate: { $lte: todayEnd },
        endDate: { $gte: todayStart },
      }),
      LeaveRequest.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(5).lean(),
      LeaveRequest.find({ status: 'approved', startDate: { $gt: todayEnd, $lte: in30 } })
        .sort({ startDate: 1 })
        .limit(6)
        .lean(),
    ]);

    const leaveIds = [...pendingDocs, ...upcomingDocs].map((l) => l.employeeId as Types.ObjectId);
    const look = await employeeLookup(leaveIds);
    const nameOf = (id: Types.ObjectId) => {
      const p = look.prof.get(String(id));
      return { name: fullName(p?.firstName, p?.middleName, p?.lastName), ini: initials(p?.firstName, p?.lastName) };
    };
    const codeOf = (id: Types.ObjectId) => look.emp.get(String(id))?.employeeCode ?? '—';

    const pendingLeaves = pendingDocs.map((l) => {
      const { name, ini } = nameOf(l.employeeId as Types.ObjectId);
      const created = (l as { createdAt?: Date }).createdAt ?? new Date();
      return {
        id: String(l._id),
        name,
        initials: ini,
        code: codeOf(l.employeeId as Types.ObjectId),
        type: LEAVE_TYPE_LABEL[l.leaveType] ?? l.leaveType,
        duration: `${l.days} ngày`,
        range:
          fmtDM(new Date(l.startDate)) === fmtDM(new Date(l.endDate))
            ? fmtDM(new Date(l.startDate))
            : `${fmtDM(new Date(l.startDate))} → ${fmtDM(new Date(l.endDate))}`,
        submitted: `${fmtDM(created)} · ${String(created.getHours()).padStart(2, '0')}:${String(created.getMinutes()).padStart(2, '0')}`,
      };
    });

    const upcomingLeaves = upcomingDocs.map((l) => {
      const { name, ini } = nameOf(l.employeeId as Types.ObjectId);
      return {
        id: String(l._id),
        name,
        initials: ini,
        code: codeOf(l.employeeId as Types.ObjectId),
        type: LEAVE_TYPE_LABEL[l.leaveType] ?? l.leaveType,
        range:
          fmtDM(new Date(l.startDate)) === fmtDM(new Date(l.endDate))
            ? fmtDM(new Date(l.startDate))
            : `${fmtDM(new Date(l.startDate))} → ${fmtDM(new Date(l.endDate))}`,
        duration: `${l.days} ngày`,
        relative: relativeDays(now, new Date(l.startDate)),
      };
    });

    // --- Payroll: latest period + its payroll rollup ---
    const period = await PayrollPeriod.findOne().sort({ startDate: -1 }).lean();
    let payroll = null as null | {
      period: string;
      status: string;
      total: string;
      totalRaw: number;
      computedRatio: number;
      headcount: number;
      payDate: string;
      breakdown: { label: string; value: string; tone?: 'neg' }[];
    };
    let payrollThisMonthTotal = 0;
    if (period) {
      const rows = await Payroll.find({ periodId: period._id })
        .select('grossSalary netSalary status')
        .lean();
      const totalNet = rows.reduce((s, r) => s + toNum(r.netSalary), 0);
      const totalGross = rows.reduce((s, r) => s + toNum(r.grossSalary), 0);
      const computedCount = rows.filter((r) => r.status !== 'draft').length;
      payrollThisMonthTotal = totalNet;
      const PERIOD_STATUS_LABEL: Record<string, string> = {
        open: 'Đang mở',
        processing: 'Đang xử lý',
        closed: 'Đã chốt',
        paid: 'Đã chi',
      };
      payroll = {
        period: period.name,
        status: PERIOD_STATUS_LABEL[period.status] ?? period.status,
        total: compactVnd(totalNet),
        totalRaw: totalNet,
        computedRatio: rows.length ? computedCount / rows.length : 0,
        headcount: rows.length,
        payDate: fmtDMY(new Date(period.payDate)),
        breakdown: [
          { label: 'Tổng Gross', value: compactVnd(totalGross) },
          { label: 'Tổng Net', value: compactVnd(totalNet) },
          {
            label: 'Khấu trừ',
            value: `−${compactVnd(Math.max(totalGross - totalNet, 0))}`,
            tone: 'neg' as const,
          },
          { label: 'Số nhân sự', value: String(rows.length) },
        ],
      };
    }

    // --- Top performers (latest approved/acknowledged evaluations) ---
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
      { $limit: 5 },
    ]);
    const perfLook = await employeeLookup(evals.map((e) => e.employeeId));
    const performers = evals.map((e, i) => {
      const p = perfLook.prof.get(String(e.employeeId));
      const emp = perfLook.emp.get(String(e.employeeId));
      return {
        rank: i + 1,
        name: fullName(p?.firstName, p?.middleName, p?.lastName),
        initials: initials(p?.firstName, p?.lastName),
        code: emp?.employeeCode ?? '—',
        role: '',
        dept: emp ? perfLook.deptName.get(String(emp.departmentId)) ?? '' : '',
        score: Math.round(e.score),
      };
    });

    // --- Recent activities (audit log) ---
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(7).lean();
    const activities = logs.map((l) => ({
      who: 'Hệ thống',
      what: `${l.action}`,
      target: l.resource,
      when: relativeTime(new Date(l.timestamp), now),
      icon: RESOURCE_ICON[l.resource] ?? 'Pencil',
    }));

    const kpis = {
      totalEmployees,
      activeEmployees,
      newHiresThisMonth,
      onLeaveToday: onLeaveTodayCount,
      pendingLeaves: pendingCount,
      lateToday: late,
      payrollThisMonth: {
        total: compactVnd(payrollThisMonthTotal),
        period: period?.name ?? '—',
      },
    };

    return {
      kpis,
      departments,
      attendanceToday,
      attendanceTrend,
      pendingLeaves,
      upcomingLeaves,
      payroll,
      performers,
      activities,
    };
  },
};
