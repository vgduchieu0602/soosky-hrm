import PayrollPeriodLockedError from "@modules/payroll/core/app/errors/PayrollPeriodLockedError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayslipRepo from "@modules/payroll/core/app/ports/PayslipRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";

const PERMISSION_KEY = "payroll:prepare";

export default class UnlockEvaluationsUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _periods: PayrollPeriodRepo,
        private readonly _payslips: PayslipRepo,
    ) {}

    public async execute(input: { periodId: string; actorUserId: string }): Promise<PayrollPeriod> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();
        if (period.status === "closed" || period.status === "paid") {
            throw new PayrollPeriodLockedError(`Period ${period.name.value} is ${period.status}, cannot unlock`);
        }

        period.unlockEvaluations();
        await this._periods.save(period);

        const approved = await this._payslips.listByPeriodAndStatus(input.periodId, "approved");
        for (const payslip of approved) {
            payslip.revertToDraft();
            await this._payslips.save(payslip);
        }

        return period;
    }
}
