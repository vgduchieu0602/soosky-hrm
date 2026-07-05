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
  kpis: DashboardKpis;
  departments: DeptCount[];
  attendanceToday: AttendanceTodayDto;
  attendanceTrend: { week: TrendSeries; month: TrendSeries };
  pendingLeaves: DashboardPendingLeave[];
  upcomingLeaves: DashboardUpcomingLeave[];
  payroll: DashboardPayroll | null;
  performers: DashboardPerformer[];
  activities: DashboardActivity[];
}
