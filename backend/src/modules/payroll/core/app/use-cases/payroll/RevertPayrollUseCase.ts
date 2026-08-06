import PayslipNotApprovedError from "@modules/payroll/core/app/errors/PayslipNotApprovedError";
import PayslipNotFoundError from "@modules/payroll/core/app/errors/PayslipNotFoundError";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import PayslipRepo from "@modules/payroll/core/app/ports/PayslipRepo";

const PERMISSION_KEY = "payroll:prepare";

/**
 * Hoàn tác một phiếu lương `approved` về `draft` để tính lại.
 *
 * @throws {AccessDeniedError}         Actor không có quyền `payroll:prepare`.
 * @throws {PayslipNotFoundError}      Không tìm thấy phiếu lương.
 * @throws {PayslipNotApprovedError}   Phiếu không ở trạng thái `approved`.
 */
export default class RevertPayrollUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _payslips: PayslipRepo,
    ) {}

    public async execute(input: { payslipId: string; actorUserId: string }): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const payslip = await this._payslips.getById(input.payslipId);
        if (payslip == undefined) throw new PayslipNotFoundError();
        if (payslip.status !== "approved") throw new PayslipNotApprovedError(payslip.status);

        payslip.revertToDraft();
        await this._payslips.save(payslip);
    }
}
