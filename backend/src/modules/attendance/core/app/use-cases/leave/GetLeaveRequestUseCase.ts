import LeaveRequestNotFoundError from "@modules/attendance/core/app/errors/LeaveRequestNotFoundError";
import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";

export interface GetLeaveRequestInput {
    leaveRequestId: string;
}

/**
 * Lấy chi tiết một đơn xin nghỉ.
 *
 * @throws {LeaveRequestNotFoundError} Không tìm thấy đơn.
 */
export default class GetLeaveRequestUseCase {
    public constructor(
        private readonly _leaveRequestRepo: LeaveRequestRepo,
    ) {}

    public async execute(input: GetLeaveRequestInput): Promise<LeaveRequest> {
        const leaveRequest = await this._leaveRequestRepo.getById(input.leaveRequestId);
        if (leaveRequest == undefined) throw new LeaveRequestNotFoundError();
        return leaveRequest;
    }
}
