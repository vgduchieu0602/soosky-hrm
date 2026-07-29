import LeaveRequestNotFoundError from "@modules/attendance/core/app/errors/LeaveRequestNotFoundError";
import LeaveRequestNotPendingError from "@modules/attendance/core/app/errors/LeaveRequestNotPendingError";
import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import { LeaveRequestDecidedEvent } from "@modules/attendance/core/domain/events/LeaveRequestDecidedEvent";
import EventBus from "@shared/core/domain/EventBus";

const PERMISSION_KEY = "attendance:manage";

export interface RejectLeaveRequestInput {
    leaveRequestId: string;
    reason:         string;
    actorUserId:    string;
}

/**
 * Từ chối một đơn xin nghỉ đang chờ duyệt — không có gì để hoàn trả vì đơn
 * pending chưa từng cộng vào số dư đã dùng.
 *
 * @throws {AccessDeniedError}           Actor không có quyền `attendance:manage`.
 * @throws {LeaveRequestNotFoundError}   Không tìm thấy đơn.
 * @throws {LeaveRequestNotPendingError} Đơn đã được xử lý.
 */
export default class RejectLeaveRequestUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _leaveRequestRepo: LeaveRequestRepo,
        private readonly _eventBus: EventBus,
    ) {}

    public async execute(input: RejectLeaveRequestInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const leaveRequest = await this._leaveRequestRepo.getById(input.leaveRequestId);
        if (leaveRequest == undefined) throw new LeaveRequestNotFoundError();
        if (!leaveRequest.status.isPending) throw new LeaveRequestNotPendingError();

        leaveRequest.reject(input.actorUserId, input.reason, new Date());
        await this._leaveRequestRepo.save(leaveRequest);

        await this._eventBus.publish([
            new LeaveRequestDecidedEvent(leaveRequest.id, leaveRequest.employeeId, false, input.reason),
        ]);
    }
}
