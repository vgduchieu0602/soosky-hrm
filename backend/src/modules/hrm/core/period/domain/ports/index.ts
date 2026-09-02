/**
 * Ports for the HR `period` feature.
 *
 * `payrollPeriods` is fundamentally an HR concept — a calendar period carrying
 * THREE independent locks (attendance, performance, payroll status). It was
 * previously embedded inside the payroll feature, which meant attendance and
 * performance (kept features) lost their edit-lock mechanism the moment payroll
 * was split out. This feature makes the period the single owner of those locks.
 *
 * Cross-feature reads (attendance / evaluation / employee / work-calendar) are
 * expressed as ports so the period use-cases stay decoupled from those features'
 * internals; concrete gateways are injected by the composition root.
 */

import type { CreatePeriodDto, UpdatePeriodDto } from '@modules/hrm/core/period/dto/period.dto';

/** Shape of a stored payroll period (defined here so ports stay model-free). */
export interface IPayrollPeriod {
  name: string;
  startDate: Date;
  endDate: Date;
  payDate: Date;
  standardWorkDays: number;
  status: 'open' | 'processing' | 'closed' | 'paid';
  closedAt?: Date | null;
  closedBy?: unknown;
  attendanceLockedAt?: Date | null;
  attendanceLockedBy?: unknown;
  performanceLockedAt?: Date | null;
  performanceLockedBy?: unknown;
  createdBy?: unknown;
  created_at?: Date;
  updated_at?: Date;
}

export type Id = string;
export type Tx = unknown;

/** A payroll period as returned to callers (mirrors `doc.toJSON()`). */
export type PeriodRecord = IPayrollPeriod & { _id: unknown; id?: string };

// ---- period repository (owned by this feature) ----

export interface PeriodRepository {
  list(): Promise<PeriodRecord[]>;
  findById(id: Id): Promise<PeriodRecord | null>;
  findByName(name: string): Promise<PeriodRecord | null>;
  namesByIds(ids: Id[]): Promise<{ _id: unknown; name: string }[]>;
  create(input: CreatePeriodDto & { standardWorkDays: number }): Promise<PeriodRecord>;
  update(id: Id, patch: UpdatePeriodDto): Promise<PeriodRecord | null>;
  delete(id: Id): Promise<void>;
  markProcessing(id: Id, tx: Tx): Promise<void>;
  markPaid(id: Id, tx: Tx): Promise<void>;
  markClosed(id: Id, byUserId: Id): Promise<PeriodRecord | null>;
  reopenToOpen(id: Id): Promise<PeriodRecord | null>;
  lockAttendance(id: Id, byUserId: Id): Promise<PeriodRecord | null>;
  unlockAttendance(id: Id): Promise<PeriodRecord | null>;
  lockPerformance(id: Id, byUserId: Id): Promise<PeriodRecord | null>;
  unlockPerformance(id: Id): Promise<PeriodRecord | null>;
}

// ---- read-models supplied by sibling features ----

export interface AttendanceSummary {
  employeeId: unknown;
  status: string;
}
export interface EmployeeLean {
  _id: unknown;
  hireDate: Date;
  terminationDate?: Date | null;
}
export interface AttendanceStatusRow {
  employeeId: unknown;
  status: string;
}
export interface ProfileName {
  employeeId: unknown;
  firstName?: string;
  middleName?: string;
  lastName?: string;
}

// ---- gateways (consumed, implemented by sibling features) ----

/** Supplies the employees + their attendance status for a date range. */
export interface AttendanceGateway {
  aggregatePeriod(employeeId: Id, start: Date, end: Date): Promise<unknown>;
  listStatusesInRange(start: Date, end: Date): Promise<AttendanceStatusRow[]>;
}

/** Supplies evaluation finalization state for a period. */
export interface EvaluationGateway {
  findForEmployeePeriod(employeeId: Id, periodId: Id): Promise<unknown>;
  finalizedEmployeeIds(periodId: Id): Promise<string[]>;
}

/** Employees whose tenure overlaps a date range (payroll run candidates). */
export interface EmployeeGateway {
  listForRun(periodStart: Date, periodEnd: Date): Promise<{ _id: unknown }[]>;
}

/**工作日 count in a range, honoring holidays. */
export interface WorkCalendarGateway {
  standardWorkDaysInRange(start: Date, end: Date, workingDays?: number[]): Promise<number>;
  companyStandardWorkDays(): Promise<number | undefined>;
}

/**
 * Implemented by the payroll feature. The period needs to know whether a period
 * still has draft payroll rows before it can be closed — this is the ONLY way
 * the period reaches into payroll, keeping the dependency one-directional
 * (payroll does not import the period feature at all).
 */
export interface PayrollReadinessPort {
  /** Number of computed-payroll rows still in `draft` for the period. */
  countDrafts(periodId: Id, employeeId?: Id): Promise<number>;
  /** Number of computed-payroll rows of any status for the period. */
  countByPeriod(periodId: Id): Promise<number>;
}

// ---- ports consumed by OTHER features (the fix for the split) ----

/** Consumed by `attendance` to block edits on attendance-locked periods. */
export interface AttendanceLockPort {
  /** Name of the locked period covering `date`, or null if none is locked. */
  lockedPeriodName(date: Date): Promise<string | null>;
}

/** Consumed by `performance` to block edits on performance-locked periods. */
export interface PerformanceLockPort {
  /** Approved/paid payroll locking this employee+period, or null. */
  findLockedPayroll(payrollPeriodId: Id, employeeId: Id): Promise<{ status: string } | null>;
  /** A period-level performance lock freezes score-changing evaluation actions. */
  isPerformancePeriodLocked(payrollPeriodId: Id): Promise<boolean>;
}

/** Consumed by `payroll` to read periods without importing this feature. */
export interface PeriodReader {
  list(): Promise<PeriodRecord[]>;
  findById(id: Id): Promise<PeriodRecord | null>;
  findByName(name: string): Promise<PeriodRecord | null>;
  /** The most recent period by startDate (used by dashboards / defaults). */
  findLatest(): Promise<PeriodRecord | null>;
  /** Resolve period ids → names for labelling lists. */
  namesByIds(ids: Id[]): Promise<{ _id: unknown; name: string }[]>;
}

/**
 * Consumed by `payroll` to advance a period's status. The period owns its own
 * status machine, so payroll requests transitions through this port instead of
 * mutating the period document directly — keeping the dependency one-directional
 * (payroll → period, never the reverse at runtime).
 */
export interface PeriodLifecycle {
  markProcessing(periodId: Id, tx: Tx): Promise<void>;
  markPaid(periodId: Id, tx: Tx): Promise<void>;
}

// ---- audit + events (shared shape, reused across features) ----

/** Mirrors `@features/payroll/domain/ports#AuditPort` so the audit record shape stays consistent. */
export interface AuditPort {
  record(entry: {
    userId: string;
    resource: string;
    action: string;
    resourceId?: string;
    changes?: Record<string, unknown>;
  }): Promise<void>;
}

/** Domain events emitted by the period use-cases. */
export interface EventsPort {
  attendanceLocked(p: { periodId: string; periodName: string }): void;
  performanceLocked(p: { periodId: string; periodName: string }): void;
  periodClosed(p: { periodId: string; periodName: string }): void;
}
