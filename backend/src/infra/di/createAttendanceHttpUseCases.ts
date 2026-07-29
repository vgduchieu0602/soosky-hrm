import { MongoAttendanceRepo, MongoAttendanceSymbolRepo, MongoHolidayRepo, MongoLeaveBalanceRepo, MongoLeaveRequestRepo, MongoShiftRepo } from "@modules/attendance/adapters/driven/persistence/mongodb";
import { AttendanceHttpUseCases } from "@modules/attendance/adapters/driver/http";
import LeaveEntitlementService from "@modules/attendance/core/app/services/LeaveEntitlementService";
import ArchiveShiftUseCase from "@modules/attendance/core/app/use-cases/shift/ArchiveShiftUseCase";
import CreateShiftUseCase from "@modules/attendance/core/app/use-cases/shift/CreateShiftUseCase";
import DeleteShiftUseCase from "@modules/attendance/core/app/use-cases/shift/DeleteShiftUseCase";
import GetShiftUseCase from "@modules/attendance/core/app/use-cases/shift/GetShiftUseCase";
import ListShiftsUseCase from "@modules/attendance/core/app/use-cases/shift/ListShiftsUseCase";
import UpdateShiftUseCase from "@modules/attendance/core/app/use-cases/shift/UpdateShiftUseCase";
import CreateHolidayUseCase from "@modules/attendance/core/app/use-cases/holiday/CreateHolidayUseCase";
import DeleteHolidayUseCase from "@modules/attendance/core/app/use-cases/holiday/DeleteHolidayUseCase";
import GetHolidayUseCase from "@modules/attendance/core/app/use-cases/holiday/GetHolidayUseCase";
import ListHolidaysUseCase from "@modules/attendance/core/app/use-cases/holiday/ListHolidaysUseCase";
import UpdateHolidayUseCase from "@modules/attendance/core/app/use-cases/holiday/UpdateHolidayUseCase";
import CreateAttendanceSymbolUseCase from "@modules/attendance/core/app/use-cases/symbol/CreateAttendanceSymbolUseCase";
import DeleteAttendanceSymbolUseCase from "@modules/attendance/core/app/use-cases/symbol/DeleteAttendanceSymbolUseCase";
import GetAttendanceSymbolUseCase from "@modules/attendance/core/app/use-cases/symbol/GetAttendanceSymbolUseCase";
import ListAttendanceSymbolsUseCase from "@modules/attendance/core/app/use-cases/symbol/ListAttendanceSymbolsUseCase";
import UpdateAttendanceSymbolUseCase from "@modules/attendance/core/app/use-cases/symbol/UpdateAttendanceSymbolUseCase";
import DeleteAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/DeleteAttendanceUseCase";
import GetAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/GetAttendanceUseCase";
import ListAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/ListAttendanceUseCase";
import UpsertAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/UpsertAttendanceUseCase";
import ApproveLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/ApproveLeaveRequestUseCase";
import CancelLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/CancelLeaveRequestUseCase";
import GetLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/GetLeaveRequestUseCase";
import ListLeaveRequestsUseCase from "@modules/attendance/core/app/use-cases/leave/ListLeaveRequestsUseCase";
import RejectLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/RejectLeaveRequestUseCase";
import SubmitLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/SubmitLeaveRequestUseCase";
import AdjustLeaveBalanceUseCase from "@modules/attendance/core/app/use-cases/leave-balance/AdjustLeaveBalanceUseCase";
import GetLeaveBalanceUseCase from "@modules/attendance/core/app/use-cases/leave-balance/GetLeaveBalanceUseCase";
import ListLeaveBalancesUseCase from "@modules/attendance/core/app/use-cases/leave-balance/ListLeaveBalancesUseCase";
import { createEmployeeDirectory } from "@modules/employee";
import { createIamAccessControl } from "@modules/iam";
import EventBus from "@shared/core/domain/EventBus";
import { Db as MongoDb } from "mongodb";

/**
 * Lắp ráp use-case của module Attendance trên nền MongoDB — điểm nối
 * (composition root) giữa core, driven adapter, cổng nhân viên của Employee
 * và cổng quyền hạn của IAM.
 *
 * `createIamAccessControl` khớp hình dạng `PermissionChecker` của Attendance;
 * `createEmployeeDirectory` khớp hình dạng `EmployeeDirectory`.
 */
export default function createAttendanceHttpUseCases(mongoDb: MongoDb, eventBus: EventBus): AttendanceHttpUseCases {
    const shiftRepo         = new MongoShiftRepo(mongoDb);
    const holidayRepo       = new MongoHolidayRepo(mongoDb);
    const symbolRepo        = new MongoAttendanceSymbolRepo(mongoDb);
    const attendanceRepo    = new MongoAttendanceRepo(mongoDb);
    const leaveRequestRepo  = new MongoLeaveRequestRepo(mongoDb);
    const leaveBalanceRepo  = new MongoLeaveBalanceRepo(mongoDb);

    const permissionCheck  = createIamAccessControl(mongoDb);
    const employeeDirectory = createEmployeeDirectory(mongoDb);
    const entitlement       = new LeaveEntitlementService(leaveBalanceRepo);

    return {
        // Shift
        createShift:  new CreateShiftUseCase(permissionCheck, shiftRepo),
        updateShift:  new UpdateShiftUseCase(permissionCheck, shiftRepo),
        getShift:     new GetShiftUseCase(shiftRepo),
        listShifts:   new ListShiftsUseCase(shiftRepo),
        archiveShift: new ArchiveShiftUseCase(permissionCheck, shiftRepo),
        deleteShift:  new DeleteShiftUseCase(permissionCheck, shiftRepo),

        // Holiday
        createHoliday: new CreateHolidayUseCase(permissionCheck, holidayRepo),
        updateHoliday: new UpdateHolidayUseCase(permissionCheck, holidayRepo),
        getHoliday:    new GetHolidayUseCase(holidayRepo),
        listHolidays:  new ListHolidaysUseCase(holidayRepo),
        deleteHoliday: new DeleteHolidayUseCase(permissionCheck, holidayRepo),

        // AttendanceSymbol
        createAttendanceSymbol: new CreateAttendanceSymbolUseCase(permissionCheck, symbolRepo),
        updateAttendanceSymbol: new UpdateAttendanceSymbolUseCase(permissionCheck, symbolRepo),
        getAttendanceSymbol:    new GetAttendanceSymbolUseCase(symbolRepo),
        listAttendanceSymbols:  new ListAttendanceSymbolsUseCase(symbolRepo),
        deleteAttendanceSymbol: new DeleteAttendanceSymbolUseCase(permissionCheck, symbolRepo),

        // Attendance
        upsertAttendance: new UpsertAttendanceUseCase(permissionCheck, attendanceRepo, shiftRepo, employeeDirectory),
        getAttendance:    new GetAttendanceUseCase(attendanceRepo),
        listAttendance:   new ListAttendanceUseCase(attendanceRepo),
        deleteAttendance: new DeleteAttendanceUseCase(permissionCheck, attendanceRepo),

        // LeaveRequest
        submitLeaveRequest:  new SubmitLeaveRequestUseCase(permissionCheck, leaveRequestRepo, holidayRepo, employeeDirectory, entitlement, eventBus),
        approveLeaveRequest: new ApproveLeaveRequestUseCase(permissionCheck, leaveRequestRepo, leaveBalanceRepo, attendanceRepo, holidayRepo, entitlement, eventBus),
        rejectLeaveRequest:  new RejectLeaveRequestUseCase(permissionCheck, leaveRequestRepo, eventBus),
        cancelLeaveRequest:  new CancelLeaveRequestUseCase(permissionCheck, leaveRequestRepo, leaveBalanceRepo, attendanceRepo),
        getLeaveRequest:     new GetLeaveRequestUseCase(leaveRequestRepo),
        listLeaveRequests:   new ListLeaveRequestsUseCase(leaveRequestRepo),

        // LeaveBalance
        adjustLeaveBalance: new AdjustLeaveBalanceUseCase(permissionCheck, leaveBalanceRepo, employeeDirectory),
        getLeaveBalance:    new GetLeaveBalanceUseCase(leaveBalanceRepo, entitlement),
        listLeaveBalances:  new ListLeaveBalancesUseCase(leaveBalanceRepo),
    };
}
