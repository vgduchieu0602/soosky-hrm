import type { AttendanceStatus, AttendanceSession } from '@modules/hrm/adapters/persistence/mongoose/models/attendance.model';
import type { LeaveType, LeaveStatus } from '@modules/hrm/adapters/persistence/mongoose/models/leave-request.model';
import type { AttendancePolicy } from '@modules/hrm/core/attendance/domain/attendance-calc';

/**
 * Ports — the abstractions the application (use-cases) depends on. Concrete
 * implementations live in `infrastructure/`. IDs cross the boundary as strings;
 * adapters convert to/from Mongoose ObjectId. `Tx` is an opaque transaction
 * handle (a Mongoose ClientSession under the hood).
 */
export type Id = string;
export type Tx = unknown;

// ---- read-models (what use-cases read; adapters return plain objects) ----

export interface AttendanceRecord {
  _id: string;
  employeeId: string;
  date: Date;
  shiftId: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
  status: AttendanceStatus;
  workHours: number | null;
  lateMinutes: number;
  earlyMinutes: number;
  session: AttendanceSession;
  source: string;
  note: string | null;
  leaveRequestId: string | null;
}

export interface RosterRow {
  _id: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  hireDate?: Date | null;
}

export interface LeaveRequestRecord {
  _id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  days: number;
  halfDaySession: string | null;
  reason: string | null;
  status: LeaveStatus;
  approverId: string | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  createdBy: string | null;
}

export interface LeaveBalanceRecord {
  _id: string;
  employeeId: string;
  leaveType: string;
  year: number;
  entitled: number;
  used: number;
}

export interface PersistedAttendanceFields {
  checkIn: Date | null;
  checkOut: Date | null;
  status: AttendanceStatus;
  workHours: number | null;
  lateMinutes: number;
  earlyMinutes: number;
  session: AttendanceSession;
}

// ---- repository ports ----

export interface AttendanceRepository {
  findByEmployeeAndRange(employeeId: Id, start: Date, end: Date): Promise<AttendanceRecord[]>;
  findForRoster(employeeIds: Id[], start: Date, end: Date): Promise<AttendanceRecord[]>;
  findFullDayLeave(employeeId: Id, date: Date): Promise<AttendanceRecord | null>;
  findBySlot(employeeId: Id, date: Date, shiftId: Id): Promise<AttendanceRecord | null>;
  findById(id: Id): Promise<AttendanceRecord | null>;
  upsertPunch(
    slot: { employeeId: Id; date: Date; shiftId: Id },
    fields: PersistedAttendanceFields & { source: string },
    createdBy: Id,
  ): Promise<AttendanceRecord>;
  createManual(data: {
    employeeId: Id; date: Date; shiftId: Id; note: string | null; source: string; createdBy: Id;
  } & PersistedAttendanceFields): Promise<AttendanceRecord>;
  updateById(
    id: Id,
    data: Partial<PersistedAttendanceFields> & {
      shiftId?: Id; note?: string | null; adjustedBy?: Id; adjustedAt?: Date;
    },
  ): Promise<AttendanceRecord | null>;
  deleteById(id: Id): Promise<boolean>;
  // leave-driven writes (transactional)
  supersedeDay(employeeId: Id, date: Date, exceptLeaveId: Id, tx: Tx): Promise<void>;
  upsertLeaveRow(
    employeeId: Id, date: Date, leaveRequestId: Id,
    fields: { session: string; status: string; source: string; createdBy: Id | null },
    tx: Tx,
  ): Promise<void>;
  deleteByLeaveRequest(leaveRequestId: Id, tx?: Tx): Promise<void>;
  roster(filter: { departmentId?: string; q?: string }): Promise<RosterRow[]>;
}

export interface LeaveRequestRepository {
  create(data: {
    employeeId: Id; leaveType: LeaveType; startDate: Date; endDate: Date; days: number;
    halfDaySession: string | null; reason: string | null; createdBy: Id;
  }): Promise<LeaveRequestRecord>;
  findById(id: Id, tx?: Tx): Promise<LeaveRequestRecord | null>;
  findByEmployee(employeeId: Id): Promise<LeaveRequestRecord[]>;
  listWithEmployee(filter: { status?: string }): Promise<Record<string, unknown>[]>;
  updateStatus(
    id: Id,
    patch: Partial<Pick<LeaveRequestRecord, 'status' | 'approverId' | 'approvedAt' | 'rejectionReason'>>,
    tx?: Tx,
  ): Promise<LeaveRequestRecord | null>;
}

export interface LeaveBalanceRepository {
  findInYearWindow(employeeId: Id, from: number, to: number, tx?: Tx): Promise<LeaveBalanceRecord[]>;
  findOne(employeeId: Id, leaveType: string, year: number, tx?: Tx): Promise<LeaveBalanceRecord | null>;
  ensureEntitlement(employeeId: Id, year: number, entitled: number, tx?: Tx): Promise<void>;
  incrementUsed(employeeId: Id, leaveType: string, year: number, delta: number, tx: Tx): Promise<void>;
  setUsed(id: Id, used: number, tx: Tx): Promise<void>;
  upsertEntitled(employeeId: Id, leaveType: string, year: number, entitled: number): Promise<LeaveBalanceRecord>;
  findByEmployeeYear(employeeId: Id, year: number): Promise<LeaveBalanceRecord[]>;
}

export interface CatalogRepository<T = Record<string, unknown>> {
  list(): Promise<T[]>;
  create(input: Record<string, unknown>): Promise<T>;
  update(id: Id, input: Record<string, unknown>): Promise<T | null>;
  remove(id: Id): Promise<boolean>;
}
export interface ShiftRepository extends CatalogRepository {
  archive(id: Id): Promise<Record<string, unknown> | null>;
}
export interface HolidayRepository extends CatalogRepository {
  findOverlapping(start: Date, end: Date): Promise<{ date: Date; isRecurring?: boolean }[]>;
}
export interface SymbolRepository extends CatalogRepository {
  findByCode(code: string): Promise<Record<string, unknown> | null>;
}

// ---- cross-feature gateways ----

export interface EmployeeGateway {
  findByUserId(userId: Id): Promise<{ _id: string } | null>;
  findById(id: Id): Promise<{ _id: string } | null>;
  isOfficial(employeeId: Id, tx?: Tx): Promise<boolean>;
}

export interface ShiftWindowGateway {
  /** Default active shift for self check-in/out (full_day preferred). */
  findDefaultShiftWindow(): Promise<{ id: string; startTime: string; endTime: string; breakMinutes: number } | null>;
  findShiftWindow(shiftId: Id): Promise<{ startTime: string; endTime: string; breakMinutes: number } | null>;
  /** Active shifts (ca) for the admin grid, sorted by start time. */
  listActiveShifts(): Promise<Record<string, unknown>[]>;
}

export interface PolicyGateway {
  loadPolicy(): Promise<AttendancePolicy>;
  annualQuota(): Promise<number>;
}

export interface PayrollLockGateway {
  /** Name of the locked payroll period covering `date`, or null. */
  lockedPeriodName(date: Date): Promise<string | null>;
}

// ---- infrastructure services ----

export interface Clock {
  now(): Date;
}

export interface AuditPort {
  record(entry: {
    userId: string; resource: string; action: string; resourceId?: string;
    changes?: Record<string, unknown>;
  }): Promise<void>;
}

export interface EventsPort {
  leaveSubmitted(p: { leaveRequestId: string; employeeId: string }): void;
  leaveDecided(p: { leaveRequestId: string; employeeId: string; approved: boolean; reason?: string }): void;
}

export interface UnitOfWork {
  withTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}
