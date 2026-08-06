import PayrollPeriodLockedError from "@modules/payroll/core/app/errors/PayrollPeriodLockedError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import RetroAdjustmentRepo from "@modules/payroll/core/app/ports/RetroAdjustmentRepo";
import RetroAdjustment, { RetroKind } from "@modules/payroll/core/domain/entities/RetroAdjustment";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "payroll:prepare";

export interface CreateRetroAdjustmentInput {
    employeeId:     string;
    kind:           RetroKind;
    amount:         number;
    originPeriodId: string;
    payoutPeriodId: string;
    reason:         string;
    taxable?:       boolean;
    actorUserId:    string;
}

/**
 * Tạo một khoản truy lĩnh/truy thu cho kỳ đã qua, chi trả ở một kỳ đang mở.
 *
 * KỲ GỐC không cần còn mở — mục đích của cả tính năng này là sửa sai cho kỳ đã
 * chốt mà KHÔNG mở lại nó (mở lại kỳ đã chi trả sẽ làm lệch số đã hạch toán và
 * đã báo thuế). Kỳ CHI TRẢ thì phải còn mở, vì tiền phải vào một bảng lương chưa
 * duyệt.
 *
 * @throws {AccessDeniedError}            Actor không có quyền `payroll:prepare`.
 * @throws {PayrollPeriodNotFoundError}   Không tìm thấy kỳ gốc hoặc kỳ chi trả.
 * @throws {PayrollPeriodLockedError}     Kỳ chi trả đã `closed`/`paid`.
 * @throws {RetroAdjustmentInvalidError}  Số tiền <= 0, thiếu lý do, hoặc kỳ gốc trùng kỳ chi trả.
 */
export default class CreateRetroAdjustmentUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _periods: PayrollPeriodRepo,
        private readonly _retros: RetroAdjustmentRepo,
    ) {}

    public async execute(input: CreateRetroAdjustmentInput): Promise<RetroAdjustment> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const originPeriod = await this._periods.getById(input.originPeriodId);
        if (originPeriod == undefined) throw new PayrollPeriodNotFoundError();

        const payoutPeriod = await this._periods.getById(input.payoutPeriodId);
        if (payoutPeriod == undefined) throw new PayrollPeriodNotFoundError();
        if (payoutPeriod.status === "closed" || payoutPeriod.status === "paid") {
            throw new PayrollPeriodLockedError(`Payout period ${payoutPeriod.name.value} is ${payoutPeriod.status}`);
        }

        const adjustment = RetroAdjustment.create({
            id:             createUuidV7(),
            employeeId:     input.employeeId,
            kind:           input.kind,
            amount:         input.amount,
            taxable:        input.taxable ?? true,
            originPeriodId: input.originPeriodId,
            payoutPeriodId: input.payoutPeriodId,
            reason:         input.reason,
            createdBy:      input.actorUserId,
        });

        await this._retros.save(adjustment);
        return adjustment;
    }
}
