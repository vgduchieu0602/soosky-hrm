import AttendanceController, { AttendanceControllerUseCases } from "@modules/attendance/adapters/driver/http/controllers/AttendanceController";
import AttendanceSymbolController, { AttendanceSymbolControllerUseCases } from "@modules/attendance/adapters/driver/http/controllers/AttendanceSymbolController";
import HolidayController, { HolidayControllerUseCases } from "@modules/attendance/adapters/driver/http/controllers/HolidayController";
import LeaveBalanceController, { LeaveBalanceControllerUseCases } from "@modules/attendance/adapters/driver/http/controllers/LeaveBalanceController";
import LeaveRequestController, { LeaveRequestControllerUseCases } from "@modules/attendance/adapters/driver/http/controllers/LeaveRequestController";
import ShiftController, { ShiftControllerUseCases } from "@modules/attendance/adapters/driver/http/controllers/ShiftController";
import authenticate from "@shared/adapters/driver/http/middlewares/authenticate";
import errorHandler from "@shared/adapters/driver/http/middlewares/errorHandler";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import { json, Router } from "express";

/** Toàn bộ use-case mà driver adapter HTTP của module Attendance cần. */
export type AttendanceHttpUseCases =
    & ShiftControllerUseCases
    & HolidayControllerUseCases
    & AttendanceSymbolControllerUseCases
    & AttendanceControllerUseCases
    & LeaveRequestControllerUseCases
    & LeaveBalanceControllerUseCases;

/**
 * Driver adapter HTTP của module Attendance. Giữ danh sách route duy nhất —
 * nhìn một chỗ thấy toàn bộ bề mặt API: parse JSON body, xác thực Bearer
 * token, định tuyến tới controller, dịch lỗi thành `{ code, message }`.
 */
export function createAttendanceHttpRouter(
    useCases: AttendanceHttpUseCases,
    accessTokenVerifier: AccessTokenVerifier,
): Router {
    const shiftController           = new ShiftController(useCases);
    const holidayController         = new HolidayController(useCases);
    const symbolController          = new AttendanceSymbolController(useCases);
    const attendanceController      = new AttendanceController(useCases);
    const leaveRequestController    = new LeaveRequestController(useCases);
    const leaveBalanceController    = new LeaveBalanceController(useCases);

    const router = Router();

    router.use(json());
    router.use(authenticate(accessTokenVerifier));

    // Shift
    router.post  ("/shifts",                 shiftController.createShift);
    router.get   ("/shifts",                 shiftController.listShifts);
    router.get   ("/shifts/:shiftId",        shiftController.getShift);
    router.patch ("/shifts/:shiftId",        shiftController.updateShift);
    router.post  ("/shifts/:shiftId/archive", shiftController.archiveShift);
    router.delete("/shifts/:shiftId",        shiftController.deleteShift);

    // Holiday
    router.post  ("/holidays",               holidayController.createHoliday);
    router.get   ("/holidays",               holidayController.listHolidays);
    router.get   ("/holidays/:holidayId",    holidayController.getHoliday);
    router.patch ("/holidays/:holidayId",    holidayController.updateHoliday);
    router.delete("/holidays/:holidayId",    holidayController.deleteHoliday);

    // AttendanceSymbol
    router.post  ("/symbols",                symbolController.createAttendanceSymbol);
    router.get   ("/symbols",                symbolController.listAttendanceSymbols);
    router.get   ("/symbols/:symbolId",      symbolController.getAttendanceSymbol);
    router.patch ("/symbols/:symbolId",      symbolController.updateAttendanceSymbol);
    router.delete("/symbols/:symbolId",      symbolController.deleteAttendanceSymbol);

    // Attendance
    router.post  ("/records",                attendanceController.upsertAttendance);
    router.get   ("/records",                attendanceController.listAttendance);
    router.get   ("/records/:attendanceId",  attendanceController.getAttendance);
    router.delete("/records/:attendanceId",  attendanceController.deleteAttendance);

    // LeaveRequest
    router.post  ("/leave-requests",                       leaveRequestController.submitLeaveRequest);
    router.get   ("/leave-requests",                       leaveRequestController.listLeaveRequests);
    router.get   ("/leave-requests/:leaveRequestId",       leaveRequestController.getLeaveRequest);
    router.post  ("/leave-requests/:leaveRequestId/approve", leaveRequestController.approveLeaveRequest);
    router.post  ("/leave-requests/:leaveRequestId/reject",  leaveRequestController.rejectLeaveRequest);
    router.post  ("/leave-requests/:leaveRequestId/cancel",  leaveRequestController.cancelLeaveRequest);

    // LeaveBalance
    router.post  ("/leave-balances",         leaveBalanceController.adjustLeaveBalance);
    router.get   ("/leave-balances",         leaveBalanceController.listLeaveBalances);
    router.get   ("/leave-balances/one",     leaveBalanceController.getLeaveBalance);

    router.use(errorHandler);

    return router;
}
