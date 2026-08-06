import LeaveRequestNotFoundError from "@modules/attendance/core/app/errors/LeaveRequestNotFoundError";
import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import LeaveAccessScope from "@modules/attendance/core/app/services/LeaveAccessScope";
import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";

export interface GetLeaveRequestInput {
    leaveRequestId: string;
    actorUserId:    string;
}

/**
 * Lấy chi tiết một đơn xin nghỉ, trong phạm vi actor được xem.
 *
 * @throws {LeaveRequestNotFoundError} Không tìm thấy đơn.
 * @throws {AccessDeniedError}         Đơn thuộc nhân viên ngoài phạm vi của actor.
 */
export default class GetLeaveRequestUseCase {
    public constructor(
        private readonly _accessScope: LeaveAccessScope,
        private readonly _leaveRequestRepo: LeaveRequestRepo,
    ) {}

    public async execute(input: GetLeaveRequestInput): Promise<LeaveRequest> {
        const leaveRequest = await this._leaveRequestRepo.getById(input.leaveRequestId);
        if (leaveRequest == undefined) throw new LeaveRequestNotFoundError();

        await this._accessScope.assertCanRead(input.actorUserId, leaveRequest.employeeId);
        return leaveRequest;
    }
}
