import AttendanceCorrectionNotFoundError from "@modules/attendance/core/app/errors/AttendanceCorrectionNotFoundError";
import AttendanceCorrectionRequestRepo from "@modules/attendance/core/app/ports/AttendanceCorrectionRequestRepo";
import AuditTrail from "@modules/attendance/core/app/ports/AuditTrail";
import AttendanceAccessScope from "@modules/attendance/core/app/services/AttendanceAccessScope";

export interface RejectAttendanceCorrectionInput {
    correctionRequestId: string;
    /** Lý do từ chối — BẮT BUỘC: người gửi phải biết vì sao để gửi lại cho đúng. */
    reason:      string;
    actorUserId: string;
}

/**
 * Từ chối yêu cầu chỉnh công. Không đụng gì tới bảng công.
 *
 * @throws {AccessDeniedError}                 Actor không được quyết định yêu cầu của nhân viên này.
 * @throws {AttendanceCorrectionNotFoundError} Không tìm thấy yêu cầu.
 * @throws {AttendanceCorrectionInvalidError}  Yêu cầu đã được quyết định, hoặc thiếu lý do từ chối.
 */
export default class RejectAttendanceCorrectionUseCase {
    public constructor(
        private readonly _accessScope: AttendanceAccessScope,
        private readonly _requestRepo: AttendanceCorrectionRequestRepo,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: RejectAttendanceCorrectionInput): Promise<void> {
        const requested = await this._requestRepo.getById(input.correctionRequestId);
        if (requested == undefined) throw new AttendanceCorrectionNotFoundError();

        await this._accessScope.assertCanDecideCorrection(input.actorUserId, requested.employeeId);

        requested.reject(input.actorUserId, input.reason);
        await this._requestRepo.save(requested);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "attendance_correction",
            action:      "reject",
            resourceId:  requested.id,
            changes:     {
                employeeId:    requested.employeeId,
                date:          requested.date,
                requestReason: requested.reason,
                decisionNote:  requested.decisionNote,
            },
        });
    }
}
