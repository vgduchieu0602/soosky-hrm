import NothingToApproveError from "@modules/payroll/core/app/errors/NothingToApproveError";
import PayrollPeriodLockedError from "@modules/payroll/core/app/errors/PayrollPeriodLockedError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import UnitOfWork from "@modules/payroll/core/app/ports/UnitOfWork";
import { PayrollApprovedEvent } from "@modules/payroll/core/domain/events/PayrollApprovedEvent";
import EventBus from "@shared/core/domain/EventBus";

const PERMISSION_KEY = "payroll:manage";

export interface ApprovePayrollOutput {
    periodId: string;
    affected: number;
}

/**
 * Duyệt các phiếu lương `draft` của một kỳ — toàn bộ, hoặc một nhân viên nếu
 * truyền `employeeId`. Duyệt toàn kỳ khi kỳ đang `open` chuyển kỳ sang
 * `processing`. Phát `payroll.approved`.
 *
 * @throws {AccessDeniedError}          Actor không có quyền `payroll:manage`.
 * @throws {PayrollPeriodNotFoundError} Không tìm thấy kỳ lương.
 * @throws {PayrollPeriodLockedError}   Kỳ đã thanh toán.
 * @throws {NothingToApproveError}      Không có phiếu draft nào để duyệt.
 */
export default class ApprovePayrollUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _uow: UnitOfWork,
        private readonly _eventBus: EventBus,
    ) {}

    public async execute(input: { periodId: string; approverUserId: string; employeeId?: string }): Promise<ApprovePayrollOutput> {
        await this._permissions.assertPermission(input.approverUserId, PERMISSION_KEY);

        const affected = await this._uow.run(async (ctx) => {
            const period = await ctx.periodRepo.getById(input.periodId);
            if (period == undefined) throw new PayrollPeriodNotFoundError();
            if (period.status === "paid") throw new PayrollPeriodLockedError(`Period ${period.name.value} is already paid`);

            const drafts = await ctx.payslipRepo.listByPeriodAndStatus(input.periodId, "draft", input.employeeId);
            if (drafts.length === 0) throw new NothingToApproveError();

            for (const payslip of drafts) {
                payslip.approve(input.approverUserId);
                await ctx.payslipRepo.save(payslip);
            }

            if (input.employeeId == undefined && period.status === "open") {
                period.markProcessing();
                await ctx.periodRepo.save(period);
            }

            return drafts.length;
        });

        await this._eventBus.publish([new PayrollApprovedEvent(input.periodId, affected, input.approverUserId)]);

        return { periodId: input.periodId, affected };
    }
}
