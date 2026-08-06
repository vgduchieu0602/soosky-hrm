import EmployeeNotFoundError from "@modules/attendance/core/app/errors/EmployeeNotFoundError";
import LeaveOverlapError from "@modules/attendance/core/app/errors/LeaveOverlapError";
import EmployeeDirectory from "@modules/attendance/core/app/ports/EmployeeDirectory";
import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";
import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import LeaveAccessScope from "@modules/attendance/core/app/services/LeaveAccessScope";
import LeaveEntitlementService from "@modules/attendance/core/app/services/LeaveEntitlementService";
import { LeaveRequestSubmittedEvent } from "@modules/attendance/core/domain/events/LeaveRequestSubmittedEvent";
import { buildHolidayChecker, countWorkingDays } from "@modules/attendance/core/domain/services/leave-calc";
import LeaveType from "@modules/attendance/core/domain/value-objects/LeaveType";
import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";
import EventBus from "@shared/core/domain/EventBus";
import createUuidV7 from "@shared/core/domain/UuidV7";

const OVERLAP_STATUSES = ["pending", "approved"];

export interface SubmitLeaveRequestInput {
    /**
     * Nhân viên xin nghỉ. BỎ TRỐNG = "tôi nộp cho chính tôi" — suy ra từ tài
     * khoản đang đăng nhập, để giao diện tự phục vụ không phải tự đi tìm
     * employeeId của mình (và không thể gửi sai id người khác).
     */
    employeeId?:     string | undefined;
    leaveType:       string;
    startDate:       Date;
    endDate:         Date;
    halfDaySession?: string;
    reason?:         string;
    actorUserId:     string;
}

export interface SubmitLeaveRequestOutput {
    leaveRequestId: string;
}

/**
 * Nộp đơn xin nghỉ phép. Ràng buộc (port từ `leave.usecases.ts::submit`):
 * ngày kết thúc không trước ngày bắt đầu, nửa ngày chỉ trong một ngày, khoảng
 * nghỉ phải có ít nhất một ngày làm việc (loại cuối tuần/ngày lễ), không được
 * trùng với đơn khác (pending/approved) trong cùng khoảng, và phải còn hạn
 * mức phép khả dụng.
 *
 * Ai nộp được cho ai: HR/Admin nộp thay MỌI nhân viên, Manager nộp cho chính
 * mình và cấp dưới, Employee chỉ nộp cho chính mình (xem {@link LeaveAccessScope}).
 *
 * @throws {AccessDeniedError}          Actor không được nộp đơn cho nhân viên này.
 * @throws {EmployeeNotFoundError}      Nhân viên không tồn tại.
 * @throws {LeaveDateRangeInvalidError} Khoảng ngày không hợp lệ / không có ngày làm việc.
 * @throws {LeaveOverlapError}          Trùng đơn khác.
 * @throws {LeaveQuotaExceededError}    Vượt hạn mức phép khả dụng.
 */
export default class SubmitLeaveRequestUseCase {
    public constructor(
        private readonly _accessScope: LeaveAccessScope,
        private readonly _leaveRequestRepo: LeaveRequestRepo,
        private readonly _holidayRepo: HolidayRepo,
        private readonly _employeeDirectory: EmployeeDirectory,
        private readonly _entitlement: LeaveEntitlementService,
        private readonly _eventBus: EventBus,
    ) {}

    public async execute(input: SubmitLeaveRequestInput): Promise<SubmitLeaveRequestOutput> {
        // Phân giải "đơn này của ai" TRƯỚC mọi thứ khác: mọi bước sau đều dựa
        // vào employeeId, và đây cũng là chốt kiểm quyền.
        const employeeId = await this._accessScope.resolveSubjectEmployeeId(input.actorUserId, input.employeeId);

        const exists = await this._employeeDirectory.employeeExists(employeeId);
        if (!exists) throw new EmployeeNotFoundError();

        const holidays = await this._holidayRepo.listOverlapping(input.startDate, input.endDate);
        const isHoliday = buildHolidayChecker(holidays.map(h => ({ date: h.date, isRecurring: h.isRecurring })));
        const halfDay = input.halfDaySession != undefined;
        const days = countWorkingDays(input.startDate, input.endDate, halfDay, isHoliday);

        const leaveType = LeaveType.create(input.leaveType);

        const overlapping = await this._leaveRequestRepo.listOverlapping(
            employeeId, input.startDate, input.endDate, OVERLAP_STATUSES,
        );
        this._assertNoOverlap(overlapping, input.halfDaySession);

        await this._entitlement.assertAvailable(employeeId, leaveType, input.startDate.getUTCFullYear(), days);

        const leaveRequest = LeaveRequest.create({
            id:             createUuidV7(),
            employeeId,
            leaveType,
            startDate:      input.startDate,
            endDate:        input.endDate,
            days,
            halfDaySession: input.halfDaySession ?? null,
            reason:         input.reason ?? null,
            createdBy:      input.actorUserId,
        });

        await this._leaveRequestRepo.save(leaveRequest);
        await this._eventBus.publish([new LeaveRequestSubmittedEvent(leaveRequest.id, leaveRequest.employeeId)]);

        return { leaveRequestId: leaveRequest.id };
    }

    /**
     * Hai đơn nửa ngày trên cùng một ngày chỉ được phép khi khác buổi
     * (sáng/chiều); mọi trường hợp khác trùng khoảng ngày đều bị chặn.
     */
    private _assertNoOverlap(others: LeaveRequest[], halfDaySession: string | undefined): void {
        const conflict = others.find(other => {
            const bothHalf = halfDaySession != undefined && other.halfDaySession != undefined;
            return !(bothHalf && other.halfDaySession !== halfDaySession);
        });
        if (conflict != undefined) throw new LeaveOverlapError();
    }
}
