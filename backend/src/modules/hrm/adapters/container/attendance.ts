/**
 * Composition root — the only place that knows about concrete adapters.
 * Wires infrastructure implementations into the application use-cases and
 * exposes them as a ready-to-use container for the HTTP layer.
 */
import { MongooseAttendanceRepository } from '@modules/hrm/adapters/persistence/mongoose/attendance/attendance.repository';
import {
  MongooseLeaveRequestRepository,
  MongooseLeaveBalanceRepository,
} from '@modules/hrm/adapters/persistence/mongoose/attendance/leave.repositories';
import {
  MongooseShiftRepository,
  MongooseHolidayRepository,
  MongooseSymbolRepository,
} from '@modules/hrm/adapters/persistence/mongoose/attendance/catalog.repositories';
import {
  MongooseEmployeeGateway,
  MongooseShiftWindowGateway,
  MongoosePolicyGateway,
  MongoosePayrollLockGateway,
} from '@modules/hrm/adapters/persistence/mongoose/attendance/gateways';
import { periodGateway } from '@modules/hrm/adapters/container/period';
import {
  SystemClock,
  AuditServiceAdapter,
  EventBusAdapter,
  MongooseUnitOfWork,
} from '@modules/hrm/adapters/services/attendance.services';
import { LeaveEntitlementService } from '@modules/hrm/core/attendance/app/leave-entitlement.service';
import { AttendanceUseCases } from '@modules/hrm/core/attendance/app/attendance.usecases';
import { LeaveUseCases } from '@modules/hrm/core/attendance/app/leave.usecases';
import { ShiftUseCases, HolidayUseCases, SymbolUseCases } from '@modules/hrm/core/attendance/app/catalog.usecases';

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
