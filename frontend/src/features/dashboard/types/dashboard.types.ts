export interface DashboardKpis {
  totalEmployees: number;
  activeEmployees: number;
  newHiresThisMonth: number;
  onLeaveToday: number;
  pendingLeaves: number;
  lateToday: number;
  payrollThisMonth: { total: string; period: string };
}

export interface DeptCount {
  name: string;
  count: number;
}

export interface AttendanceTodayDto {
  onTime: number;
  late: number;
  onLeave: number;
  notChecked: number;
}

export interface TrendSeries {
  labels: string[];
  attend: number[];
  late: number[];
}

export interface DashboardPendingLeave {
  id: string;
  name: string;
  initials: string;
  code: string;
  type: string;
  duration: string;
  range: string;
  submitted: string;
}

export interface DashboardUpcomingLeave {
  id: string;
  name: string;
  initials: string;
  code: string;
  type: string;
  range: string;
  duration: string;
  relative: string;
}

export interface DashboardPayroll {
  period: string;
  status: string;
  total: string;
  totalRaw: number;
  computedRatio: number;
  headcount: number;
  payDate: string;
  breakdown: { label: string; value: string; tone?: "neg" }[];
}

export interface DashboardPerformer {
  rank: number;
  name: string;
  initials: string;
  code: string;
  role: string;
  dept: string;
  score: number;
}

export interface DashboardActivity {
  who: string;
  what: string;
  target: string;
  when: string;
  icon: string;
}

export interface DashboardOverview {
  /** Phạm vi dữ liệu backend đã áp: `all` | `team` | `self`. */
  scope: "all" | "team" | "self";
  /** Timezone công ty backend dùng để cắt ngày. */
  timezone: string;
  generatedAt: string;
  kpis: DashboardKpis;
  departments: DeptCount[];
  attendanceToday: AttendanceTodayDto;
  attendanceTrend: { week: TrendSeries; month: TrendSeries };
  pendingLeaves: DashboardPendingLeave[];
  upcomingLeaves: DashboardUpcomingLeave[];
  payroll: DashboardPayroll | null;
  /** Phiếu lương của CHÍNH người đang đăng nhập; `null` khi chưa có. */
  myPayslip: { periodName: string; status: string; netSalary: number } | null;
  /**
   * Hình dạng đổi theo phạm vi: tiến độ chu kỳ (all), số phiếu phải chấm (team),
   * trạng thái phiếu của mình (self). `null` = không được xem / chưa có.
   */
  performance: {
    cycleId?: string;
    cycleStatus?: string;
    lockedCount?: number;
    pendingCount?: number;
    reviewsToScore?: number;
    myReviewStatus?: string;
  } | null;
  performers: DashboardPerformer[];
  activities: DashboardActivity[];
}
