import AttendanceCorrectionNotFoundError from "@modules/attendance/core/app/errors/AttendanceCorrectionNotFoundError";
import AttendanceCorrectionRequestRepo from "@modules/attendance/core/app/ports/AttendanceCorrectionRequestRepo";
import AuditTrail from "@modules/attendance/core/app/ports/AuditTrail";
import AttendanceAccessScope from "@modules/attendance/core/app/services/AttendanceAccessScope";
import AttendanceDayWriter from "@modules/attendance/core/app/services/AttendanceDayWriter";

export interface ApproveAttendanceCorrectionInput {
    correctionRequestId: string;
    note?: string | undefined;
    actorUserId: string;
}

export interface ApproveAttendanceCorrectionOutput {
    totalCong: number;
}

/**
 * Quản lý trực tiếp hoặc HR duyệt yêu cầu chỉnh công — DUYỆT LÀ ÁP DỤNG NGAY:
 * bảng công của ngày đó được tính lại từ giờ vào/ra trong yêu cầu.
 *
 * Áp dụng ngay thay vì để HR nhập lại tay: nếu tách hai bước thì luôn có khả
 * năng duyệt rồi quên nhập, và số công vẫn sai dù yêu cầu đã "được duyệt".
 *
 * Dùng đúng {@link AttendanceDayWriter} như HR nhập tay, nên kết quả giống hệt
 * và kỳ đã chốt vẫn bị chặn ở đây (kỳ có thể bị chốt sau lúc gửi yêu cầu).
 *
 * Thứ tự CỐ Ý: ghi bảng công TRƯỚC, đổi trạng thái yêu cầu SAU. Ghi công lỗi
 * (kỳ vừa bị chốt) thì yêu cầu vẫn ở `pending` để duyệt lại — thà còn việc phải
 * làm còn hơn có yêu cầu `approved` mà bảng công không đổi.
 *
 * @throws {AccessDeniedError}                Actor không được duyệt yêu cầu của nhân viên này.
 * @throws {AttendanceCorrectionNotFoundError} Không tìm thấy yêu cầu.
 * @throws {AttendanceCorrectionInvalidError}  Yêu cầu đã được quyết định trước đó.
 * @throws {AttendancePeriodLockedError}       Kỳ đã chốt chấm công.
 * @throws {NoApplicableShiftError}            Ngày đó không có ca nào áp dụng.
 */
export default class ApproveAttendanceCorrectionUseCase {
    public constructor(
        private readonly _accessScope: AttendanceAccessScope,
        private readonly _requestRepo: AttendanceCorrectionRequestRepo,
        private readonly _dayWriter: AttendanceDayWriter,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: ApproveAttendanceCorrectionInput): Promise<ApproveAttendanceCorrectionOutput> {
        const requested = await this._requestRepo.getById(input.correctionRequestId);
        if (requested == undefined) throw new AttendanceCorrectionNotFoundError();

        // Kiểm quyền SAU khi đọc: phải biết yêu cầu của ai mới xét được phạm vi.
        await this._accessScope.assertCanDecideCorrection(input.actorUserId, requested.employeeId);

        // Đổi trạng thái trong bộ nhớ trước để chặn ngay yêu cầu đã quyết định,
        // nhưng chỉ LƯU sau khi ghi bảng công thành công.
        requested.approve(input.actorUserId, input.note ?? null);

        const written = await this._dayWriter.write({
            employeeId: requested.employeeId,
            date:       requested.date,
            checkIn:    requested.requestedCheckIn,
            checkOut:   requested.requestedCheckOut,
            note:       requested.reason,
            source:     "correction",
        });

        await this._requestRepo.save(requested);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "attendance_correction",
            action:      "approve",
            resourceId:  requested.id,
            changes:     {
                employeeId:        requested.employeeId,
                date:              requested.date,
                appliedCheckIn:    requested.requestedCheckIn,
                appliedCheckOut:   requested.requestedCheckOut,
                requestReason:     requested.reason,
                decisionNote:      requested.decisionNote,
                totalCongAfter:    written.totalCong,
            },
        });

        return { totalCong: written.totalCong };
    }
}
