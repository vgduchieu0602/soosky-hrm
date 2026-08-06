import PayrollPeriodLockedError from "@modules/payroll/core/app/errors/PayrollPeriodLockedError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import AuditTrail from "@modules/payroll/core/app/ports/AuditTrail";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayslipRepo from "@modules/payroll/core/app/ports/PayslipRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";

const PERMISSION_KEY = "payroll:prepare";

/**
 * Mở lại chốt chấm công để sửa dữ liệu. Vì dữ liệu đầu vào sẽ đổi, mọi phiếu
 * lương `approved` (chưa `paid`) của kỳ được hoàn tác về `draft` để chốt lại
 * sau này tính lại đúng.
 *
 * `reason` BẮT BUỘC và luôn vào nhật ký audit: mở khoá là hành vi rủi ro nhất
 * trong toàn bộ luồng lương (đổi số liệu sau khi đã chốt), nên tối thiểu phải
 * trả lời được "ai mở, khi nào, vì sao" mà không cần đi hỏi ai.
 *
 * @throws {AccessDeniedError}         Actor không có quyền `payroll:prepare`.
 * @throws {PayrollPeriodNotFoundError} Không tìm thấy kỳ.
 * @throws {PayrollPeriodLockedError}   Kỳ đã `closed`/`paid` — không mở lại được.
 */
export default class UnlockAttendanceUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _periods: PayrollPeriodRepo,
        private readonly _payslips: PayslipRepo,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: { periodId: string; reason: string; actorUserId: string }): Promise<PayrollPeriod> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();
        if (period.status === "closed" || period.status === "paid") {
            throw new PayrollPeriodLockedError(`Period ${period.name.value} is ${period.status}, cannot unlock`);
        }

        const lockedAt = period.attendanceLockedAt;

        period.unlockAttendance();
        await this._periods.save(period);

        const approved = await this._payslips.listByPeriodAndStatus(input.periodId, "approved");
        for (const payslip of approved) {
            payslip.revertToDraft();
            await this._payslips.save(payslip);
        }

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "payroll_period",
            action:      "unlock_attendance",
            resourceId:  period.id,
            changes:     {
                periodName:            period.name.value,
                previouslyLockedAt:    lockedAt,
                reason:                input.reason,
                revertedApprovedSlips: approved.length,
            },
        });

        return period;
    }
}
