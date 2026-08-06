import LeaveRequestNotFoundError from "@modules/attendance/core/app/errors/LeaveRequestNotFoundError";
import LeaveRequestNotPendingError from "@modules/attendance/core/app/errors/LeaveRequestNotPendingError";
import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import LeaveDecisionAuthorizer from "@modules/attendance/core/app/services/LeaveDecisionAuthorizer";
import { LeaveRequestDecidedEvent } from "@modules/attendance/core/domain/events/LeaveRequestDecidedEvent";
import EventBus from "@shared/core/domain/EventBus";

export interface RejectLeaveRequestInput {
    leaveRequestId: string;
    reason:         string;
    actorUserId:    string;
}

/**
 * Từ chối một đơn xin nghỉ đang chờ duyệt — không có gì để hoàn trả vì đơn
 * pending chưa từng cộng vào số dư đã dùng.
 *
 * @throws {AccessDeniedError}           Actor không được quyết định đơn của nhân viên này
 *                                   (HR duyệt mọi đơn, Manager chỉ đơn cấp dưới).
 * @throws {LeaveRequestNotFoundError}   Không tìm thấy đơn.
 * @throws {LeaveRequestNotPendingError} Đơn đã được xử lý.
 */
export default class RejectLeaveRequestUseCase {
    public constructor(
        private readonly _decisionAuthorizer: LeaveDecisionAuthorizer,
        private readonly _leaveRequestRepo: LeaveRequestRepo,
        private readonly _eventBus: EventBus,
    ) {}

    public async execute(input: RejectLeaveRequestInput): Promise<void> {
        const leaveRequest = await this._leaveRequestRepo.getById(input.leaveRequestId);
        if (leaveRequest == undefined) throw new LeaveRequestNotFoundError();

        // Kiểm quyền SAU khi đọc đơn: phải biết đơn của ai mới xét được phạm vi
        // team. Đơn không tồn tại thì 404 chứ không 403 — không tiết lộ gì thêm.
        await this._decisionAuthorizer.assertCanDecide(input.actorUserId, leaveRequest.employeeId);

        if (!leaveRequest.status.isPending) throw new LeaveRequestNotPendingError();

        leaveRequest.reject(input.actorUserId, input.reason, new Date());
        await this._leaveRequestRepo.save(leaveRequest);

        await this._eventBus.publish([
            new LeaveRequestDecidedEvent(leaveRequest.id, leaveRequest.employeeId, false, input.reason),
        ]);
    }
}
