import LeaveOverlapError from "@modules/attendance/core/app/errors/LeaveOverlapError";
import LeaveRequestNotFoundError from "@modules/attendance/core/app/errors/LeaveRequestNotFoundError";
import LeaveRequestNotPendingError from "@modules/attendance/core/app/errors/LeaveRequestNotPendingError";
import AttendancePeriodLockedError from "@modules/attendance/core/app/errors/AttendancePeriodLockedError";
import AttendancePeriodLockDirectory from "@modules/attendance/core/app/ports/AttendancePeriodLockDirectory";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";
import LeaveBalanceRepo from "@modules/attendance/core/app/ports/LeaveBalanceRepo";
import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import LeaveDecisionAuthorizer from "@modules/attendance/core/app/services/LeaveDecisionAuthorizer";
import LeaveEntitlementService from "@modules/attendance/core/app/services/LeaveEntitlementService";
import { LeaveRequestDecidedEvent } from "@modules/attendance/core/domain/events/LeaveRequestDecidedEvent";
import Attendance from "@modules/attendance/core/domain/entities/Attendance";
import LeaveBalance from "@modules/attendance/core/domain/entities/LeaveBalance";
import { buildHolidayChecker, leaveDays } from "@modules/attendance/core/domain/services/leave-calc";
import AttendanceSession from "@modules/attendance/core/domain/value-objects/AttendanceSession";
import AttendanceStatus from "@modules/attendance/core/domain/value-objects/AttendanceStatus";
import EventBus from "@shared/core/domain/EventBus";
import createUuidV7 from "@shared/core/domain/UuidV7";

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
 * @throws {AccessDeniedError}           Actor không được quyết định đơn của nhân viên này
 *                                   (HR duyệt mọi đơn, Manager chỉ đơn cấp dưới).
 * @throws {LeaveRequestNotFoundError}   Không tìm thấy đơn.
 * @throws {LeaveRequestNotPendingError} Đơn đã được xử lý.
 * @throws {LeaveOverlapError}           Một đơn khác đã duyệt trùng khoảng ngày.
 * @throws {LeaveQuotaExceededError}     Vượt hạn mức phép khả dụng.
 * @throws {AttendancePeriodLockedError} Khoảng nghỉ chạm vào kỳ đã chốt chấm công.
 */
export default class ApproveLeaveRequestUseCase {
    public constructor(
        private readonly _decisionAuthorizer: LeaveDecisionAuthorizer,
        private readonly _leaveRequestRepo: LeaveRequestRepo,
        private readonly _leaveBalanceRepo: LeaveBalanceRepo,
        private readonly _attendanceRepo: AttendanceRepo,
        private readonly _holidayRepo: HolidayRepo,
        private readonly _entitlement: LeaveEntitlementService,
        private readonly _eventBus: EventBus,
        private readonly _periodLocks: AttendancePeriodLockDirectory,
    ) {}

    public async execute(input: ApproveLeaveRequestInput): Promise<void> {
        const leaveRequest = await this._leaveRequestRepo.getById(input.leaveRequestId);
        if (leaveRequest == undefined) throw new LeaveRequestNotFoundError();

        // Kiểm quyền SAU khi đọc đơn: phải biết đơn của ai mới xét được phạm vi
        // team. Đơn không tồn tại thì 404 chứ không 403 — không tiết lộ gì thêm.
        await this._decisionAuthorizer.assertCanDecide(input.actorUserId, leaveRequest.employeeId);

        if (!leaveRequest.status.isPending) throw new LeaveRequestNotPendingError();

        const overlapping = await this._leaveRequestRepo.listOverlapping(
            leaveRequest.employeeId, leaveRequest.startDate, leaveRequest.endDate, OVERLAP_STATUSES,
        );
        const conflict = overlapping.some(other => other.id !== leaveRequest.id);
        if (conflict) throw new LeaveOverlapError();

        // Duyệt đơn SINH bản ghi chấm công, nên cũng là thao tác ghi bảng công:
        // kỳ đã chốt thì phải chặn ở đây, nếu không số công sẽ đổi sau khi lương
        // đã tính. Chặn TRƯỚC khi trừ số dư để không có trạng thái nửa vời.
        await this._assertPeriodOpen(leaveRequest.startDate, leaveRequest.endDate);

        const year = leaveRequest.startDate.getUTCFullYear();
        await this._entitlement.assertAvailable(leaveRequest.employeeId, leaveRequest.leaveType, year, leaveRequest.days);

        leaveRequest.approve(input.actorUserId, new Date());
        await this._leaveRequestRepo.save(leaveRequest);

        let balance = await this._leaveBalanceRepo.getOne(leaveRequest.employeeId, leaveRequest.leaveType.value, year);
        if (balance == undefined) {
            balance = LeaveBalance.create({
                id:         createUuidV7(),
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

    /**
     * Đơn có thể trải qua nhiều kỳ; chỉ cần MỘT ngày nằm trong kỳ đã chốt là
     * không duyệt được.
     */
    private async _assertPeriodOpen(start: Date, end: Date): Promise<void> {
        for (const day of [start, end]) {
            const locked = await this._periodLocks.findLockedPeriodCovering(day);
            if (locked != undefined) throw new AttendancePeriodLockedError(locked.name);
        }
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
                id:             createUuidV7(),
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
