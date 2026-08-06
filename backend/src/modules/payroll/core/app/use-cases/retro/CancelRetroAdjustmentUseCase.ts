import PayslipAlreadyFinalizedError from "@modules/payroll/core/app/errors/PayslipAlreadyFinalizedError";
import RetroAdjustmentNotFoundError from "@modules/payroll/core/app/errors/RetroAdjustmentNotFoundError";
import PayslipRepo from "@modules/payroll/core/app/ports/PayslipRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import RetroAdjustmentRepo from "@modules/payroll/core/app/ports/RetroAdjustmentRepo";

const PERMISSION_KEY = "payroll:prepare";

export interface CancelRetroAdjustmentInput {
    adjustmentId: string;
    reason:       string;
    actorUserId:  string;
}

/**
 * Huỷ một khoản hồi tố khi phiếu lương của kỳ chi trả CÒN `draft`.
 *
 * Không xoá bản ghi: giữ lại kèm người huỷ + lý do, vì "khoản truy thu 3tr đã
 * biến mất" là đúng loại thay đổi mà kiểm toán sẽ hỏi. Phiếu đã duyệt/đã chi thì
 * không huỷ được nữa — phải tạo một khoản hồi tố NGƯỢC ở kỳ sau.
 *
 * @throws {AccessDeniedError}              Actor không có quyền `payroll:prepare`.
 * @throws {RetroAdjustmentNotFoundError}   Không tìm thấy khoản điều chỉnh.
 * @throws {PayslipAlreadyFinalizedError}   Phiếu lương kỳ chi trả đã `approved`/`paid`.
 * @throws {RetroAdjustmentInvalidError}    Đã huỷ trước đó, hoặc thiếu lý do huỷ.
 */
export default class CancelRetroAdjustmentUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _retros: RetroAdjustmentRepo,
        private readonly _payslips: PayslipRepo,
    ) {}

    public async execute(input: CancelRetroAdjustmentInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const adjustment = await this._retros.getById(input.adjustmentId);
        if (adjustment == undefined) throw new RetroAdjustmentNotFoundError();

        const payslip = await this._payslips.findOne(adjustment.payoutPeriodId, adjustment.employeeId);
        if (payslip != undefined && payslip.status !== "draft") {
            throw new PayslipAlreadyFinalizedError(payslip.status);
        }

        adjustment.cancel(input.actorUserId, input.reason);
        await this._retros.save(adjustment);
    }
}
