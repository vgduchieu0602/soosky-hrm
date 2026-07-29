import LeaveOverlapError from "@modules/attendance/core/app/errors/LeaveOverlapError";
import LeaveRequestNotFoundError from "@modules/attendance/core/app/errors/LeaveRequestNotFoundError";
import LeaveRequestNotPendingError from "@modules/attendance/core/app/errors/LeaveRequestNotPendingError";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";
import LeaveBalanceRepo from "@modules/attendance/core/app/ports/LeaveBalanceRepo";
import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import LeaveEntitlementService from "@modules/attendance/core/app/services/LeaveEntitlementService";
import { LeaveRequestDecidedEvent } from "@modules/attendance/core/domain/events/LeaveRequestDecidedEvent";
import Attendance from "@modules/attendance/core/domain/entities/Attendance";
import LeaveBalance from "@modules/attendance/core/domain/entities/LeaveBalance";
import { buildHolidayChecker, leaveDays } from "@modules/attendance/core/domain/services/leave-calc";
import AttendanceSession from "@modules/attendance/core/domain/value-objects/AttendanceSession";
import AttendanceStatus from "@modules/attendance/core/domain/value-objects/AttendanceStatus";
import EventBus from "@shared/core/domain/EventBus";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_KEY = "attendance:manage";
const OVERLAP_STATUSES = ["approved"];

export interface ApproveLeaveRequestInput {
    leaveRequestId: string;
    actorUserId:    string;
}

/**
 * Duyệt đơn xin nghỉ: cộng số ngày vào `used` của số dư phép năm tương ứng
 * rồi sinh bản ghi chấm công (`leave_paid`/`leave_unpaid`) cho từng ngày làm
 * việc mà đơn bao phủ — port từ `leave.usecases.ts::approve`.
 *
 * Chặn duyệt hai đơn chồng lấn ngày (một đơn khác đã APPROVED trước đó trên
 * cùng khoảng sẽ tính trùng số dư và ghi đè chấm công).
 *
 * @throws {AccessDeniedError}           Actor không có quyền `attendance:manage`.
 * @throws {LeaveRequestNotFoundError}   Không tìm thấy đơn.
 * @throws {LeaveRequestNotPendingError} Đơn đã được xử lý.
 * @throws {LeaveOverlapError}           Một đơn khác đã duyệt trùng khoảng ngày.
 * @throws {LeaveQuotaExceededError}     Vượt hạn mức phép khả dụng.
 */
export default class ApproveLeaveRequestUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _leaveRequestRepo: LeaveRequestRepo,
        private readonly _leaveBalanceRepo: LeaveBalanceRepo,
        private readonly _attendanceRepo: AttendanceRepo,
        private readonly _holidayRepo: HolidayRepo,
        private readonly _entitlement: LeaveEntitlementService,
        private readonly _eventBus: EventBus,
    ) {}

    public async execute(input: ApproveLeaveRequestInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const leaveRequest = await this._leaveRequestRepo.getById(input.leaveRequestId);
        if (leaveRequest == undefined) throw new LeaveRequestNotFoundError();
        if (!leaveRequest.status.isPending) throw new LeaveRequestNotPendingError();

        const overlapping = await this._leaveRequestRepo.listOverlapping(
            leaveRequest.employeeId, leaveRequest.startDate, leaveRequest.endDate, OVERLAP_STATUSES,
        );
        const conflict = overlapping.some(other => other.id !== leaveRequest.id);
        if (conflict) throw new LeaveOverlapError();

        const year = leaveRequest.startDate.getUTCFullYear();
        await this._entitlement.assertAvailable(leaveRequest.employeeId, leaveRequest.leaveType, year, leaveRequest.days);

        leaveRequest.approve(input.actorUserId, new Date());
        await this._leaveRequestRepo.save(leaveRequest);

        let balance = await this._leaveBalanceRepo.getOne(leaveRequest.employeeId, leaveRequest.leaveType.value, year);
        if (balance == undefined) {
            balance = LeaveBalance.create({
                id:         UUIDv7(),
                employeeId: leaveRequest.employeeId,
                leaveType:  leaveRequest.leaveType,
                year,
                entitled:   0,
            });
        }
        balance.incrementUsed(leaveRequest.days);
        await this._leaveBalanceRepo.save(balance);

        await this._syncLeaveAttendance(leaveRequest.employeeId, leaveRequest.id, leaveRequest.leaveType.isUnpaid,
            leaveRequest.startDate, leaveRequest.endDate, leaveRequest.halfDaySession);

        await this._eventBus.publish([
            new LeaveRequestDecidedEvent(leaveRequest.id, leaveRequest.employeeId, true),
        ]);
    }

    private async _syncLeaveAttendance(
        employeeId: string,
        leaveRequestId: string,
        isUnpaid: boolean,
        start: Date,
        end: Date,
        halfDaySession: string | null,
    ): Promise<void> {
        const holidays = await this._holidayRepo.listOverlapping(start, end);
        const isHoliday = buildHolidayChecker(holidays.map(h => ({ date: h.date, isRecurring: h.isRecurring })));
        const days = leaveDays(start, end, halfDaySession, isHoliday);
        const status = isUnpaid ? AttendanceStatus.LEAVE_UNPAID : AttendanceStatus.LEAVE_PAID;
        const session = halfDaySession == undefined ? AttendanceSession.FULL_DAY : AttendanceSession.create(halfDaySession);

        for (const day of days) {
            const attendance = Attendance.create({
                id:             UUIDv7(),
                employeeId,
                date:           day,
                shiftId:        "",
                checkIn:        null,
                checkOut:       null,
                status,
                workHours:      0,
                lateMinutes:    0,
                earlyMinutes:   0,
                session,
                congWeight:     halfDaySession == undefined ? 1 : 0.5,
                source:         "leave",
                note:           null,
                leaveRequestId,
            });
            await this._attendanceRepo.save(attendance);
        }
    }
}
