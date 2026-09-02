/**
 * Composition root — the only place that knows about concrete adapters.
 * Wires infrastructure implementations into the application use-cases and
 * exposes them as a ready-to-use container for the HTTP layer.
 */
import { MongooseAttendanceRepository } from '@features/attendance/infrastructure/attendance.repository.mongoose';
import {
  MongooseLeaveRequestRepository,
  MongooseLeaveBalanceRepository,
} from '@features/attendance/infrastructure/leave.repositories.mongoose';
import {
  MongooseShiftRepository,
  MongooseHolidayRepository,
  MongooseSymbolRepository,
} from '@features/attendance/infrastructure/catalog.repositories.mongoose';
import {
  MongooseEmployeeGateway,
  MongooseShiftWindowGateway,
  MongoosePolicyGateway,
  MongoosePayrollLockGateway,
} from '@features/attendance/infrastructure/gateways.mongoose';
import { periodGateway } from '@features/period/container';
import {
  SystemClock,
  AuditServiceAdapter,
  EventBusAdapter,
  MongooseUnitOfWork,
} from '@features/attendance/infrastructure/services';
import { LeaveEntitlementService } from '@features/attendance/application/leave-entitlement.service';
import { AttendanceUseCases } from '@features/attendance/application/attendance.usecases';
import { LeaveUseCases } from '@features/attendance/application/leave.usecases';
import { ShiftUseCases, HolidayUseCases, SymbolUseCases } from '@features/attendance/application/catalog.usecases';

// --- infrastructure ---
const attendanceRepo = new MongooseAttendanceRepository();
const leaveRequestRepo = new MongooseLeaveRequestRepository();
const leaveBalanceRepo = new MongooseLeaveBalanceRepository();
const shiftRepo = new MongooseShiftRepository();
const holidayRepo = new MongooseHolidayRepository();
const symbolRepo = new MongooseSymbolRepository();

const employeeGw = new MongooseEmployeeGateway();
const shiftWindowGw = new MongooseShiftWindowGateway();
const policyGw = new MongoosePolicyGateway();
const lockGw = new MongoosePayrollLockGateway(periodGateway);

const clock = new SystemClock();
const audit = new AuditServiceAdapter();
const events = new EventBusAdapter();
const uow = new MongooseUnitOfWork();

// --- application ---
const entitlement = new LeaveEntitlementService(leaveBalanceRepo, employeeGw, policyGw);

export const attendanceUseCases = new AttendanceUseCases(
  attendanceRepo, employeeGw, shiftWindowGw, policyGw, lockGw, audit, clock, entitlement,
);
export const leaveUseCases = new LeaveUseCases(
  leaveRequestRepo, leaveBalanceRepo, attendanceRepo, holidayRepo, employeeGw, audit, events, uow, entitlement, clock,
);
export const shiftUseCases = new ShiftUseCases(shiftRepo, audit);
export const holidayUseCases = new HolidayUseCases(holidayRepo, audit);
export const symbolUseCases = new SymbolUseCases(symbolRepo, audit);
export const leaveEntitlement = entitlement;
