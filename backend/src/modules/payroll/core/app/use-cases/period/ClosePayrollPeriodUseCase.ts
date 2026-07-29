import PayrollPeriodDraftRemainingError from "@modules/payroll/core/app/errors/PayrollPeriodDraftRemainingError";
import PayrollPeriodLockedError from "@modules/payroll/core/app/errors/PayrollPeriodLockedError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayslipRepo from "@modules/payroll/core/app/ports/PayslipRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";

const PERMISSION_KEY = "payroll:manage";

/**
 * Chốt kỳ lương — không cho sửa/chạy lương nữa. Từ chối nếu còn phiếu lương
 * `draft` (phải duyệt hoặc hoàn tác hết trước).
 *
 * @throws {AccessDeniedError}                 Actor không có quyền `payroll:manage`.
 * @throws {PayrollPeriodNotFoundError}        Không tìm thấy kỳ lương.
 * @throws {PayrollPeriodLockedError}           Kỳ đã thanh toán.
 * @throws {PayrollPeriodDraftRemainingError}   Còn phiếu lương draft.
 */
export default class ClosePayrollPeriodUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _periods: PayrollPeriodRepo,
        private readonly _payslips: PayslipRepo,
    ) {}

    public async execute(input: { periodId: string; actorUserId: string }): Promise<PayrollPeriod> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();
        if (period.status === "paid") throw new PayrollPeriodLockedError(`Period ${period.name.value} is already paid`);

        const draftCount = await this._payslips.countByStatus(input.periodId, "draft");
        if (draftCount > 0) throw new PayrollPeriodDraftRemainingError(draftCount);

        period.close(input.actorUserId);
        await this._periods.save(period);

        return period;
    }
}
