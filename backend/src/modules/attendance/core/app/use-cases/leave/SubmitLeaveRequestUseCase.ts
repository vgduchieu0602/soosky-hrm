import EmployeeNotFoundError from "@modules/attendance/core/app/errors/EmployeeNotFoundError";
import LeaveOverlapError from "@modules/attendance/core/app/errors/LeaveOverlapError";
import EmployeeDirectory from "@modules/attendance/core/app/ports/EmployeeDirectory";
import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";
import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import LeaveEntitlementService from "@modules/attendance/core/app/services/LeaveEntitlementService";
import { LeaveRequestSubmittedEvent } from "@modules/attendance/core/domain/events/LeaveRequestSubmittedEvent";
import { buildHolidayChecker, countWorkingDays } from "@modules/attendance/core/domain/services/leave-calc";
import LeaveType from "@modules/attendance/core/domain/value-objects/LeaveType";
import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";
import EventBus from "@shared/core/domain/EventBus";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_KEY = "attendance:manage";
const OVERLAP_STATUSES = ["pending", "approved"];

export interface SubmitLeaveRequestInput {
    employeeId:      string;
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
 * @throws {AccessDeniedError}          Actor không có quyền `attendance:manage`.
 * @throws {EmployeeNotFoundError}      Nhân viên không tồn tại.
 * @throws {LeaveDateRangeInvalidError} Khoảng ngày không hợp lệ / không có ngày làm việc.
 * @throws {LeaveOverlapError}          Trùng đơn khác.
 * @throws {LeaveQuotaExceededError}    Vượt hạn mức phép khả dụng.
 */
export default class SubmitLeaveRequestUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _leaveRequestRepo: LeaveRequestRepo,
        private readonly _holidayRepo: HolidayRepo,
        private readonly _employeeDirectory: EmployeeDirectory,
        private readonly _entitlement: LeaveEntitlementService,
        private readonly _eventBus: EventBus,
    ) {}

    public async execute(input: SubmitLeaveRequestInput): Promise<SubmitLeaveRequestOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const exists = await this._employeeDirectory.employeeExists(input.employeeId);
        if (!exists) throw new EmployeeNotFoundError();

        const holidays = await this._holidayRepo.listOverlapping(input.startDate, input.endDate);
        const isHoliday = buildHolidayChecker(holidays.map(h => ({ date: h.date, isRecurring: h.isRecurring })));
        const halfDay = input.halfDaySession != undefined;
        const days = countWorkingDays(input.startDate, input.endDate, halfDay, isHoliday);

        const leaveType = LeaveType.create(input.leaveType);

        const overlapping = await this._leaveRequestRepo.listOverlapping(
            input.employeeId, input.startDate, input.endDate, OVERLAP_STATUSES,
        );
        this._assertNoOverlap(overlapping, input.halfDaySession);

        await this._entitlement.assertAvailable(input.employeeId, leaveType, input.startDate.getUTCFullYear(), days);

        const leaveRequest = LeaveRequest.create({
            id:             UUIDv7(),
            employeeId:     input.employeeId,
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
