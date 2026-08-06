import NothingToApproveError from "@modules/payroll/core/app/errors/NothingToApproveError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import VarianceUnsignedError from "@modules/payroll/core/app/errors/VarianceUnsignedError";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayrollVarianceRepo from "@modules/payroll/core/app/ports/PayrollVarianceRepo";
import PayslipRepo from "@modules/payroll/core/app/ports/PayslipRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";

const PERMISSION_KEY = "payroll:prepare";

/**
 * HR chốt "đã soát bảng lương thử" — bước bắt buộc trước khi người có thẩm quyền
 * duyệt. Đây là quyền của người LẬP (`payroll:prepare`), không phải người duyệt:
 * người lập soát số của mình, người duyệt là mắt thứ hai.
 *
 * @throws {AccessDeniedError}          Actor không có quyền `payroll:prepare`.
 * @throws {PayrollPeriodNotFoundError} Không tìm thấy kỳ lương.
 * @throws {NothingToApproveError}      Kỳ chưa có phiếu lương nào để soát.
 * @throws {VarianceUnsignedError}      Còn chênh lệch đối soát chưa được giải thích và ký.
 * @throws {PayrollStageInvalidError}   Kỳ chưa tính thử, hoặc đã qua bước này.
 */
export default class MarkPayrollHrReviewedUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _periods: PayrollPeriodRepo,
        private readonly _payslips: PayslipRepo,
        private readonly _variances: PayrollVarianceRepo,
    ) {}

    public async execute(input: { periodId: string; actorUserId: string }): Promise<PayrollPeriod> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();

        // Soát một kỳ chưa có phiếu nào là soát cái không tồn tại.
        const drafts = await this._payslips.countByStatus(input.periodId, "draft");
        if (drafts === 0) throw new NothingToApproveError();

        // Cổng chạy song song: đã đối soát và còn chênh lệch chưa ký thì không soát
        // xong được. Kỳ chưa từng chạy đối soát không có bản ghi nào -> không bị chặn.
        const unsigned = await this._variances.countUnsigned(input.periodId);
        if (unsigned > 0) throw new VarianceUnsignedError(unsigned);

        period.markHrReviewed(input.actorUserId);
        await this._periods.save(period);

        return period;
    }
}
