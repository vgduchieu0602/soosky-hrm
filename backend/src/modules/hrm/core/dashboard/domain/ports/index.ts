/**
 * Ports — the abstractions the dashboard use-cases depend on. Concrete
 * implementations live in `infrastructure/`. Dashboard is a read-only
 * aggregation feature: the repository exposes granular query methods that
 * return plain read-models; all formatting/orchestration lives in the
 * application layer. IDs cross the boundary as strings.
 */
export type Id = string;

// ---- read-models (plain objects returned by the repository) ----

export interface EmployeeCounts {
  total: number;
  active: number;
  newHires: number;
}

export interface DeptCount {
  departmentId: string | null;
  count: number;
}

export interface DeptName {
  _id: string;
  name: string;
}

export interface AttStatusCount {
  status: string;
  count: number;
}

export interface MonthlyTrendRow {
  month: number;
  total: number;
  present: number;
  late: number;
}

export interface DailyTrendRow {
  day: string;
  total: number;
  present: number;
  late: number;
}

export interface LeaveDoc {
  _id: string;
  employeeId: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  createdAt?: Date;
}

export interface EmployeeInfo {
  _id: string;
  employeeCode: string;
  departmentId: string | null;
}

export interface ProfileInfo {
  employeeId: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
}

export interface EmployeeLookupData {
  employees: EmployeeInfo[];
  profiles: ProfileInfo[];
  departments: DeptName[];
}

export interface PayrollPeriodInfo {
  _id: string;
  name: string;
  status: string;
  payDate: Date;
}

export interface PayrollRow {
  grossSalary: unknown;
  netSalary: unknown;
  status: string;
}

export interface EvalRow {
  employeeId: string;
  score: number;
}

export interface AuditRow {
  action: string;
  resource: string;
  timestamp: Date;
}

// ---- repository port ----

export interface DashboardRepository {
  employeeCounts(monthStart: Date): Promise<EmployeeCounts>;
  departmentDistribution(): Promise<DeptCount[]>;
  departmentNames(ids: string[]): Promise<DeptName[]>;
  attendanceTodayByStatus(start: Date, end: Date): Promise<AttStatusCount[]>;
  attendanceMonthlyTrend(yearStart: Date): Promise<MonthlyTrendRow[]>;
  attendanceWeeklyTrend(start: Date, end: Date): Promise<DailyTrendRow[]>;
  leavePendingCount(): Promise<number>;
  leaveOnTodayCount(start: Date, end: Date): Promise<number>;
  latestPendingLeaves(limit: number): Promise<LeaveDoc[]>;
  upcomingApprovedLeaves(after: Date, until: Date, limit: number): Promise<LeaveDoc[]>;
  employeeLookup(ids: string[]): Promise<EmployeeLookupData>;
  latestPayrollPeriod(): Promise<PayrollPeriodInfo | null>;
  payrollRows(periodId: string): Promise<PayrollRow[]>;
  topEvaluations(limit: number): Promise<EvalRow[]>;
  recentAuditLogs(limit: number): Promise<AuditRow[]>;
}

// ---- infrastructure services ----

export interface Clock {
  now(): Date;
}
