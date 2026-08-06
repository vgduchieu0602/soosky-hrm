import PayrollVarianceRepo from "@modules/payroll/core/app/ports/PayrollVarianceRepo";
import PayrollVariance from "@modules/payroll/core/domain/entities/PayrollVariance";

/**
 * Bảng đối soát của một kỳ. Không kiểm quyền riêng: router đã xác thực, và mọi
 * người đọc được bảng lương của kỳ đều cần thấy chênh lệch — che nó đi thì đối
 * soát mất tác dụng.
 */
export default class ListPayrollVariancesUseCase {
    public constructor(
        private readonly _variances: PayrollVarianceRepo,
    ) {}

    public async execute(input: { periodId: string }): Promise<PayrollVariance[]> {
        return this._variances.listByPeriod(input.periodId);
    }
}
