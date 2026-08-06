import { MongoAttendanceCorrectionRequestRepo, MongoAttendanceRepo, MongoAttendanceSymbolRepo, MongoHolidayRepo, MongoLeaveBalanceRepo, MongoLeaveRequestRepo, MongoShiftRepo } from "@modules/attendance/adapters/driven/persistence/mongodb";
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
import ListVisibleAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/ListVisibleAttendanceUseCase";
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
import ApproveAttendanceCorrectionUseCase from "@modules/attendance/core/app/use-cases/correction/ApproveAttendanceCorrectionUseCase";
import ListAttendanceCorrectionsUseCase from "@modules/attendance/core/app/use-cases/correction/ListAttendanceCorrectionsUseCase";
import RejectAttendanceCorrectionUseCase from "@modules/attendance/core/app/use-cases/correction/RejectAttendanceCorrectionUseCase";
import SubmitAttendanceCorrectionUseCase from "@modules/attendance/core/app/use-cases/correction/SubmitAttendanceCorrectionUseCase";
import AttendanceAccessScope from "@modules/attendance/core/app/services/AttendanceAccessScope";
import AttendanceDayWriter from "@modules/attendance/core/app/services/AttendanceDayWriter";
import LeaveAccessScope from "@modules/attendance/core/app/services/LeaveAccessScope";
import LeaveDecisionAuthorizer from "@modules/attendance/core/app/services/LeaveDecisionAuthorizer";
import { createEmployeeDirectory } from "@modules/employee";
import { createIamAccessControl, createIamAuditTrail } from "@modules/iam";
import { createPayrollPeriodLockDirectory } from "@modules/payroll";
import { createCompanyCalendar } from "@modules/setting";
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
    const correctionRepo    = new MongoAttendanceCorrectionRequestRepo(mongoDb);

    const permissionCheck  = createIamAccessControl(mongoDb);
    const employeeDirectory = createEmployeeDirectory(mongoDb);

    // Quyền quyết định đơn nghỉ phụ thuộc chuỗi quản lý, nên cần cả RBAC lẫn
    // danh bạ nhân viên — gom vào một service để duyệt và từ chối dùng chung.
    const leaveDecisionAuthorizer = new LeaveDecisionAuthorizer(permissionCheck, employeeDirectory);

    // Nộp/huỷ/xem đơn nghỉ theo phạm vi: HR mọi người, Manager team, Employee
    // chính mình. Dùng chung một service để ba nhóm hành động không lệch luật.
    const leaveAccessScope = new LeaveAccessScope(permissionCheck, employeeDirectory);

    // Bảng công + chỉnh công: đọc theo phạm vi, duyệt theo chuỗi quản lý.
    const attendanceAccessScope = new AttendanceAccessScope(permissionCheck, employeeDirectory);

    // Timezone lấy từ cấu hình công ty (Setting) và trạng thái chốt kỳ lấy từ
    // Payroll — Attendance chỉ biết hai cổng, không import thẳng module nào.
    const companyCalendar = createCompanyCalendar(mongoDb);
    const periodLocks     = createPayrollPeriodLockDirectory(mongoDb);
    const auditTrail      = createIamAuditTrail(mongoDb);

    // MỘT đường duy nhất biến giờ vào/ra thành bản ghi chấm công — HR nhập tay
    // và chỉnh công được duyệt đều đi qua đây.
    const dayWriter = new AttendanceDayWriter(attendanceRepo, shiftRepo, holidayRepo, companyCalendar, periodLocks);
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
        upsertAttendance: new UpsertAttendanceUseCase(permissionCheck, employeeDirectory, dayWriter),
        getAttendance:    new GetAttendanceUseCase(attendanceAccessScope, attendanceRepo),
        listAttendance:   new ListAttendanceUseCase(attendanceAccessScope, attendanceRepo),
        listVisibleAttendance: new ListVisibleAttendanceUseCase(attendanceAccessScope, attendanceRepo),
        deleteAttendance: new DeleteAttendanceUseCase(permissionCheck, attendanceRepo, periodLocks),

        // LeaveRequest
        submitLeaveRequest:  new SubmitLeaveRequestUseCase(leaveAccessScope, leaveRequestRepo, holidayRepo, employeeDirectory, entitlement, eventBus),
        approveLeaveRequest: new ApproveLeaveRequestUseCase(leaveDecisionAuthorizer, leaveRequestRepo, leaveBalanceRepo, attendanceRepo, holidayRepo, entitlement, eventBus, periodLocks),
        rejectLeaveRequest:  new RejectLeaveRequestUseCase(leaveDecisionAuthorizer, leaveRequestRepo, eventBus),
        cancelLeaveRequest:  new CancelLeaveRequestUseCase(leaveAccessScope, leaveRequestRepo, leaveBalanceRepo, attendanceRepo, periodLocks),
        getLeaveRequest:     new GetLeaveRequestUseCase(leaveAccessScope, leaveRequestRepo),
        listLeaveRequests:   new ListLeaveRequestsUseCase(leaveAccessScope, leaveRequestRepo),

        // LeaveBalance
        adjustLeaveBalance: new AdjustLeaveBalanceUseCase(permissionCheck, leaveBalanceRepo, employeeDirectory),
        getLeaveBalance:    new GetLeaveBalanceUseCase(leaveBalanceRepo, entitlement),
        listLeaveBalances:  new ListLeaveBalancesUseCase(leaveAccessScope, leaveBalanceRepo, entitlement),

        // Chỉnh công
        submitAttendanceCorrection:  new SubmitAttendanceCorrectionUseCase(attendanceAccessScope, correctionRepo, employeeDirectory, companyCalendar, periodLocks, auditTrail),
        listAttendanceCorrections:   new ListAttendanceCorrectionsUseCase(attendanceAccessScope, correctionRepo),
        approveAttendanceCorrection: new ApproveAttendanceCorrectionUseCase(attendanceAccessScope, correctionRepo, dayWriter, auditTrail),
        rejectAttendanceCorrection:  new RejectAttendanceCorrectionUseCase(attendanceAccessScope, correctionRepo, auditTrail),
    };
}
