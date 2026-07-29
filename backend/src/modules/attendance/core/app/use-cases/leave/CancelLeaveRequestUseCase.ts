import LeaveRequestNotFoundError from "@modules/attendance/core/app/errors/LeaveRequestNotFoundError";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import LeaveBalanceRepo from "@modules/attendance/core/app/ports/LeaveBalanceRepo";
import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import LeaveStatus from "@modules/attendance/core/domain/value-objects/LeaveStatus";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";

const PERMISSION_KEY = "attendance:manage";

export interface CancelLeaveRequestInput {
    leaveRequestId: string;
    reason?:        string;
    actorUserId:    string;
}

/**
 * Huỷ một đơn xin nghỉ — đơn `pending` huỷ trực tiếp; đơn `approved` (thu
 * hồi) hoàn trả lại số ngày vào số dư `used` và xoá bản ghi chấm công đã
 * sinh (port từ `leave.usecases.ts::revoke`). Đơn `rejected`/`cancelled`
 * không huỷ lại được.
 *
 * @throws {AccessDeniedError}         Actor không có quyền `attendance:manage`,
 *                                     hoặc đơn đã ở trạng thái cuối (rejected/cancelled).
 * @throws {LeaveRequestNotFoundError} Không tìm thấy đơn.
 */
export default class CancelLeaveRequestUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _leaveRequestRepo: LeaveRequestRepo,
        private readonly _leaveBalanceRepo: LeaveBalanceRepo,
        private readonly _attendanceRepo: AttendanceRepo,
    ) {}

    public async execute(input: CancelLeaveRequestInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const leaveRequest = await this._leaveRequestRepo.getById(input.leaveRequestId);
        if (leaveRequest == undefined) throw new LeaveRequestNotFoundError();

        if (leaveRequest.status.equals(LeaveStatus.REJECTED) || leaveRequest.status.equals(LeaveStatus.CANCELLED)) {
            throw new AccessDeniedError();
        }

        const wasApproved = leaveRequest.status.isApproved;

        leaveRequest.cancel(input.reason ?? null);
        await this._leaveRequestRepo.save(leaveRequest);

        if (wasApproved) {
            const year = leaveRequest.startDate.getUTCFullYear();
            const balance = await this._leaveBalanceRepo.getOne(leaveRequest.employeeId, leaveRequest.leaveType.value, year);
            if (balance != undefined) {
                balance.incrementUsed(-leaveRequest.days);
                await this._leaveBalanceRepo.save(balance);
            }
            await this._attendanceRepo.deleteByLeaveRequestId(leaveRequest.id);
        }
    }
}
