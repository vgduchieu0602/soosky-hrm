import LeaveRequestNotFoundError from "@modules/attendance/core/app/errors/LeaveRequestNotFoundError";
import AttendancePeriodLockedError from "@modules/attendance/core/app/errors/AttendancePeriodLockedError";
import AttendancePeriodLockDirectory from "@modules/attendance/core/app/ports/AttendancePeriodLockDirectory";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import LeaveBalanceRepo from "@modules/attendance/core/app/ports/LeaveBalanceRepo";
import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import LeaveAccessScope from "@modules/attendance/core/app/services/LeaveAccessScope";
import LeaveStatus from "@modules/attendance/core/domain/value-objects/LeaveStatus";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";

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
 * Huỷ dùng chung quyền với NỘP (`leave:submit`): huỷ đơn của chính mình là
 * phần tự nhiên của tự phục vụ, còn HR huỷ thay được cho mọi người.
 *
 * @throws {AccessDeniedError}         Actor không được huỷ đơn của nhân viên này,
 *                                     hoặc đơn đã ở trạng thái cuối (rejected/cancelled).
 * @throws {LeaveRequestNotFoundError} Không tìm thấy đơn.
 * @throws {AttendancePeriodLockedError} Đơn đã duyệt và thuộc kỳ đã chốt chấm công.
 */
export default class CancelLeaveRequestUseCase {
    public constructor(
        private readonly _accessScope: LeaveAccessScope,
        private readonly _leaveRequestRepo: LeaveRequestRepo,
        private readonly _leaveBalanceRepo: LeaveBalanceRepo,
        private readonly _attendanceRepo: AttendanceRepo,
        private readonly _periodLocks: AttendancePeriodLockDirectory,
    ) {}

    public async execute(input: CancelLeaveRequestInput): Promise<void> {
        const leaveRequest = await this._leaveRequestRepo.getById(input.leaveRequestId);
        if (leaveRequest == undefined) throw new LeaveRequestNotFoundError();

        // Kiểm quyền SAU khi đọc đơn: phải biết đơn của ai mới xét được phạm vi.
        // Đơn không tồn tại thì 404 chứ không 403 — không tiết lộ gì thêm.
        await this._accessScope.assertCanSubmitFor(input.actorUserId, leaveRequest.employeeId);

        if (leaveRequest.status.equals(LeaveStatus.REJECTED) || leaveRequest.status.equals(LeaveStatus.CANCELLED)) {
            throw new AccessDeniedError();
        }

        const wasApproved = leaveRequest.status.isApproved;

        // Huỷ đơn ĐÃ DUYỆT sẽ hoàn số dư và xoá bản ghi chấm công đã sinh — cũng
        // là ghi bảng công, nên kỳ đã chốt thì chặn. Đơn `pending` chưa chạm vào
        // bảng công nên huỷ lúc nào cũng được.
        if (wasApproved) {
            const locked = await this._periodLocks.findLockedPeriodCovering(leaveRequest.startDate);
            if (locked != undefined) throw new AttendancePeriodLockedError(locked.name);
        }

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
