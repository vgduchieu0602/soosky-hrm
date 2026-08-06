import api from "@core/http/axios";
import type {
  AttendanceTodayDto,
  DashboardActivity,
  DashboardOverview,
  DashboardPayroll,
  DashboardPendingLeave,
  DashboardUpcomingLeave,
  DeptCount,
  TrendSeries,
} from "@features/dashboard/types/dashboard.types";

/** DTO của `GET /dashboard/overview` — khớp `share-docs/API-SPEC.md`. */
interface AttendanceDayDto {
  date: string;
  present: number;
  late: number;
  incomplete: number;
  onLeave: number;
  absent: number;
  notRecorded: number;
}

interface LeaveQueueItemDto {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  submittedAt: string;
}

interface OverviewDto {
  generatedAt: string;
  timezone: string;
  scope: "all" | "team" | "self";
  headcount: {
    total: number;
    active: number;
    newHiresThisMonth: number;
    byDepartment: { departmentId: string; name: string; count: number }[];
  } | null;
  attendanceToday: AttendanceDayDto;
  attendanceTrend: { last7Days: AttendanceDayDto[]; last30Days: AttendanceDayDto[] };
  pendingApprovals: {
    leaveRequests: number;
    correctionRequests: number;
    leaveItems: LeaveQueueItemDto[];
  } | null;
  upcomingLeaves: LeaveQueueItemDto[];
  payroll: {
    periodId: string;
    name: string;
    stage: string;
    status: string;
    payDate: string;
    headcount: number;
    totals: { gross: number; net: number; finalizedCount: number };
  } | null;
  myPayslip: { periodName: string; status: string; netSalary: number } | null;
  performance: {
    cycleId?: string;
    cycleStatus?: string;
    lockedCount?: number;
    pendingCount?: number;
    reviewsToScore?: number;
    myReviewStatus?: string;
  } | null;
  auditActivity: {
    id: string;
    actorUserId: string | null;
    resource: string;
    action: string;
    resourceId: string | null;
    occurredAt: string;
  }[] | null;
}

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: "Phép năm",
  sick: "Nghỉ ốm",
  personal: "Việc riêng",
  unpaid: "Không lương",
  maternity: "Thai sản",
  paternity: "Vợ sinh",
};

/** `YYYY-MM-DD` → `DD/MM/YYYY`. Ngày đã theo timezone công ty từ backend. */
function fmtDMY(dayKey: string): string {
  return dayKey.split("-").reverse().join("/");
}

function fmtVnd(amount: number): string {
  return amount.toLocaleString("vi-VN");
}

/** Mốc tương đối so với hôm nay, chỉ để hiển thị. */
function relativeDays(iso: string): string {
  const target = new Date(iso.slice(0, 10)).getTime();
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const days = Math.round((target - today) / 86_400_000);
  if (days === 0) return "hôm nay";
  return days > 0 ? `trong ${days} ngày` : `${Math.abs(days)} ngày trước`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${last}${first}`.toUpperCase() || "?";
}

function toTrend(days: AttendanceDayDto[]): TrendSeries {
  return {
    labels: days.map((day) => day.date.slice(5)),
    attend: days.map((day) => day.present + day.late),
    late: days.map((day) => day.late),
  };
}

function toPendingLeave(item: LeaveQueueItemDto): DashboardPendingLeave {
  return {
    id: item.id,
    name: item.employeeName,
    initials: initialsOf(item.employeeName),
    code: item.employeeCode,
    type: LEAVE_TYPE_LABEL[item.leaveType] ?? item.leaveType,
    duration: `${item.days} ngày`,
    range: `${fmtDMY(item.startDate)} – ${fmtDMY(item.endDate)}`,
    submitted: relativeDays(item.submittedAt),
  };
}

function toUpcomingLeave(item: LeaveQueueItemDto): DashboardUpcomingLeave {
  return {
    id: item.id,
    name: item.employeeName,
    initials: initialsOf(item.employeeName),
    code: item.employeeCode,
    type: LEAVE_TYPE_LABEL[item.leaveType] ?? item.leaveType,
    range: `${fmtDMY(item.startDate)} – ${fmtDMY(item.endDate)}`,
    duration: `${item.days} ngày`,
    relative: relativeDays(item.startDate),
  };
}

function toPayroll(dto: OverviewDto["payroll"]): DashboardPayroll | null {
  if (dto == null) return null;

  const deductions = dto.totals.gross - dto.totals.net;
  return {
    period: dto.name,
    status: dto.stage,
    total: fmtVnd(dto.totals.net),
    totalRaw: dto.totals.net,
    computedRatio: dto.headcount === 0 ? 0 : Math.round((dto.totals.finalizedCount / dto.headcount) * 100),
    headcount: dto.headcount,
    payDate: fmtDMY(dto.payDate),
    breakdown: [
      { label: "Tổng thu nhập", value: fmtVnd(dto.totals.gross) },
      { label: "Khấu trừ", value: fmtVnd(deductions), tone: "neg" },
    ],
  };
}

function toActivities(dto: OverviewDto["auditActivity"]): DashboardActivity[] {
  if (dto == null) return [];

  return dto.map((entry) => ({
    who: entry.actorUserId ?? "Hệ thống",
    what: entry.action,
    target: entry.resourceId == null ? entry.resource : `${entry.resource} · ${entry.resourceId.slice(0, 8)}…`,
    when: relativeDays(entry.occurredAt),
    icon: entry.resource,
  }));
}

/**
 * Tổng quan bảng điều khiển — MỘT lời gọi API.
 *
 * Backend (`GET /dashboard/overview`) quyết định actor thấy gì theo `dashboard:read`
 * (all/team/self). Frontend KHÔNG ghép dữ liệu từ Employee/Attendance/Payroll/IAM
 * nữa: làm vậy khiến phạm vi quyền nằm rải rác ở từng endpoint và không ai kiểm
 * được tổng thể.
 *
 * `null` trong DTO nghĩa là KHÔNG ĐƯỢC XEM hoặc không có nguồn dữ liệu — khác
 * `[]`/`0` (được xem nhưng rỗng). Chỗ nào backend trả `null` thì UI để trống
 * trung thực, không suy ra số.
 */
export const dashboardService = {
  async overview(): Promise<DashboardOverview> {
    const { data } = await api.get<OverviewDto>("/dashboard/overview");

    const attendanceToday: AttendanceTodayDto = {
      onTime: data.attendanceToday.present,
      late: data.attendanceToday.late,
      onLeave: data.attendanceToday.onLeave,
      notChecked: data.attendanceToday.notRecorded,
    };

    const departments: DeptCount[] = (data.headcount?.byDepartment ?? [])
      .map((row) => ({ name: row.name, count: row.count }));

    const payroll = toPayroll(data.payroll);

    return {
      scope: data.scope,
      timezone: data.timezone,
      generatedAt: data.generatedAt,
      kpis: {
        totalEmployees: data.headcount?.total ?? 0,
        activeEmployees: data.headcount?.active ?? 0,
        newHiresThisMonth: data.headcount?.newHiresThisMonth ?? 0,
        onLeaveToday: data.attendanceToday.onLeave,
        pendingLeaves: data.pendingApprovals?.leaveRequests ?? 0,
        lateToday: data.attendanceToday.late,
        payrollThisMonth: { total: payroll?.total ?? "0", period: payroll?.period ?? "—" },
      },
      departments,
      attendanceToday,
      attendanceTrend: {
        week: toTrend(data.attendanceTrend.last7Days),
        month: toTrend(data.attendanceTrend.last30Days),
      },
      pendingLeaves: (data.pendingApprovals?.leaveItems ?? []).map(toPendingLeave),
      upcomingLeaves: data.upcomingLeaves.map(toUpcomingLeave),
      payroll,
      myPayslip: data.myPayslip,
      performance: data.performance,
      // Không được xem nhật ký -> `null` ở DTO; UI hiện danh sách rỗng.
      activities: toActivities(data.auditActivity),
      // Xếp hạng nhân sự chưa có chính sách quyền riêng -> backend không trả, UI để trống.
      performers: [],
    };
  },
};
