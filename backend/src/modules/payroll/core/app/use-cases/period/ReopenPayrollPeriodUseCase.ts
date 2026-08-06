import PayrollPeriodLockedError from "@modules/payroll/core/app/errors/PayrollPeriodLockedError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayslipRepo from "@modules/payroll/core/app/ports/PayslipRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";

const PERMISSION_KEY = "payroll:approve";

/**
 * Mở lại một kỳ đã `closed` để sửa/chạy lại — hoàn tác mọi phiếu lương
 * `approved` về `draft` (nếu không, sẽ không tính lại được: recompute chỉ
 * cho phép trên phiếu `draft`). Kỳ `paid` không thể mở lại.
 *
 * @throws {AccessDeniedError}          Actor không có quyền `payroll:approve`.
 * @throws {PayrollPeriodNotFoundError} Không tìm thấy kỳ lương.
 * @throws {PayrollPeriodLockedError}   Kỳ đã thanh toán.
 */
export default class ReopenPayrollPeriodUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _periods: PayrollPeriodRepo,
        private readonly _payslips: PayslipRepo,
    ) {}

    public async execute(input: { periodId: string; actorUserId: string }): Promise<PayrollPeriod> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();
        if (period.status === "open") return period;
        if (period.status === "paid") {
            throw new PayrollPeriodLockedError(`Period ${period.name.value} is already paid — cannot reopen`);
        }

        const approved = await this._payslips.listByPeriodAndStatus(input.periodId, "approved");
        for (const payslip of approved) {
            payslip.revertToDraft();
            await this._payslips.save(payslip);
        }

        period.reopen();
        await this._periods.save(period);

        return period;
    }
}
