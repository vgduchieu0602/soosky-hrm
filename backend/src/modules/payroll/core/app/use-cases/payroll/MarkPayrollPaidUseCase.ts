import NothingToPayError from "@modules/payroll/core/app/errors/NothingToPayError";
import PayrollPeriodDraftRemainingError from "@modules/payroll/core/app/errors/PayrollPeriodDraftRemainingError";
import PayrollPeriodLockedError from "@modules/payroll/core/app/errors/PayrollPeriodLockedError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import SelfApprovalForbiddenError from "@modules/payroll/core/app/errors/SelfApprovalForbiddenError";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import UnitOfWork from "@modules/payroll/core/app/ports/UnitOfWork";
import { PayrollPaidEvent } from "@modules/payroll/core/domain/events/PayrollPaidEvent";
import EventBus from "@shared/core/domain/EventBus";

const PERMISSION_KEY = "payroll:approve";

export interface MarkPayrollPaidOutput {
    periodId: string;
    affected: number;
}

/**
 * Đánh dấu toàn bộ phiếu lương `approved` của một kỳ là đã thanh toán và khoá
 * kỳ (`paid`). Từ chối nếu còn phiếu `draft` (phải duyệt hết trước). Phát
 * `payroll.paid`.
 *
 * @throws {AccessDeniedError}                Actor không có quyền `payroll:approve`.
 * @throws {PayrollPeriodNotFoundError}       Không tìm thấy kỳ lương.
 * @throws {PayrollPeriodLockedError}         Kỳ đã thanh toán.
 * @throws {PayrollPeriodDraftRemainingError} Còn phiếu lương draft.
 * @throws {NothingToPayError}                Không có phiếu approved nào để thanh toán.
 * @throws {SelfApprovalForbiddenError}       Người chi trả chính là người đã lập lương kỳ này.
 */
export default class MarkPayrollPaidUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _uow: UnitOfWork,
        private readonly _eventBus: EventBus,
    ) {}

    public async execute(input: { periodId: string; payerUserId: string }): Promise<MarkPayrollPaidOutput> {
        await this._permissions.assertPermission(input.payerUserId, PERMISSION_KEY);

        const affected = await this._uow.run(async (ctx) => {
            const period = await ctx.periodRepo.getById(input.periodId);
            if (period == undefined) throw new PayrollPeriodNotFoundError();
            if (period.status === "paid") throw new PayrollPeriodLockedError(`Period ${period.name.value} is already paid`);
            if (period.preparedBy != null && period.preparedBy === input.payerUserId) {
                throw new SelfApprovalForbiddenError("mark as paid");
            }

            const draftCount = await ctx.payslipRepo.countByStatus(input.periodId, "draft");
            if (draftCount > 0) throw new PayrollPeriodDraftRemainingError(draftCount);

            const approved = await ctx.payslipRepo.listByPeriodAndStatus(input.periodId, "approved");
            if (approved.length === 0) throw new NothingToPayError();

            const now = new Date();
            for (const payslip of approved) {
                payslip.markPaid(now);
                await ctx.payslipRepo.save(payslip);
            }

            period.markPaid();
            await ctx.periodRepo.save(period);

            return approved.length;
        });

        await this._eventBus.publish([new PayrollPaidEvent(input.periodId, affected, input.payerUserId)]);

        return { periodId: input.periodId, affected };
    }
}
