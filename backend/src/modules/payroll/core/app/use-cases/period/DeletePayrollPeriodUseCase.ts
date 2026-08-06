import PayrollPeriodHasDataError from "@modules/payroll/core/app/errors/PayrollPeriodHasDataError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayslipRepo from "@modules/payroll/core/app/ports/PayslipRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "payroll:prepare";

/**
 * Xoá một kỳ lương tạo nhầm — chỉ khi kỳ CHƯA có phiếu lương nào.
 *
 * @throws {AccessDeniedError}           Actor không có quyền `payroll:prepare`.
 * @throws {PayrollPeriodNotFoundError}  Không tìm thấy kỳ lương.
 * @throws {PayrollPeriodHasDataError}   Kỳ đã có phiếu lương.
 */
export default class DeletePayrollPeriodUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _periods: PayrollPeriodRepo,
        private readonly _payslips: PayslipRepo,
    ) {}

    public async execute(input: { periodId: string; actorUserId: string }): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();

        const count = await this._payslips.countByPeriod(input.periodId);
        if (count > 0) throw new PayrollPeriodHasDataError();

        await this._periods.deleteById(input.periodId);
    }
}
